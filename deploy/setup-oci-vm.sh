#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# OCI Calculator — VM Setup Script
# Run this on a fresh OCI Always Free VM (Oracle Linux / Ubuntu)
#
# Usage:
#   1. SSH into your free-tier VM
#   2. Upload this script or curl it from your repo
#   3. Run: sudo bash setup-oci-vm.sh
#
# What it does:
#   - Installs Nginx, Python 3, Git, certbot
#   - Clones (or configures) the repo
#   - Sets up Nginx to serve the static site
#   - Creates a systemd timer for code pulls & price updates
#   - Opens firewall ports 80/443
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────
REPO_URL="https://github.com/YOUR_USERNAME/oci-calculator.git"   # ← Update this
INSTALL_DIR="/var/www/oci-calculator"
DOMAIN="_"                # ← Set to your domain for SSL, or "_" for IP-only
DEPLOY_USER="opc"        # Default OCI Oracle Linux user; use "ubuntu" for Ubuntu

# ── Detect OS ────────────────────────────────────────────────────────
if [ -f /etc/oracle-release ] || grep -qi "oracle" /etc/os-release 2>/dev/null; then
    PKG_MGR="dnf"
    echo "Detected: Oracle Linux"
elif grep -qi "ubuntu" /etc/os-release 2>/dev/null; then
    PKG_MGR="apt"
    echo "Detected: Ubuntu"
else
    echo "Unsupported OS. This script supports Oracle Linux and Ubuntu."
    exit 1
fi

# ── Install Packages ────────────────────────────────────────────────
echo "Installing packages..."
if [ "$PKG_MGR" = "dnf" ]; then
    dnf install -y nginx python3 git cronie
    systemctl enable --now crond
elif [ "$PKG_MGR" = "apt" ]; then
    apt update
    apt install -y nginx python3 git cron
    systemctl enable --now cron
fi

# ── Clone Repository ────────────────────────────────────────────────
if [ -d "$INSTALL_DIR/.git" ]; then
    echo "Repository already exists at $INSTALL_DIR, pulling latest..."
    cd "$INSTALL_DIR" && git pull
else
    echo "Cloning repository..."
    git clone "$REPO_URL" "$INSTALL_DIR"
fi
chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$INSTALL_DIR"

# ── Initial Price Update ────────────────────────────────────────────
echo "Running initial pricing update..."
cd "$INSTALL_DIR" && sudo -u "$DEPLOY_USER" bash update-prices.sh

# ── Nginx Configuration ─────────────────────────────────────────────
echo "Configuring Nginx..."
cat > /etc/nginx/conf.d/oci-calculator.conf <<'NGINX'
server {
    listen 80;
    server_name _;

    root /var/www/oci-calculator;
    index index.html;

    # Cache static assets
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1h;
        add_header Cache-Control "public, immutable";
    }

    # Don't cache pricing data or HTML (so updates are seen immediately)
    location ~* \.(json|html)$ {
        expires -1;
        add_header Cache-Control "no-cache, must-revalidate";
    }

    location / {
        try_files $uri $uri/ =404;
    }
}
NGINX

# Replace server_name if a domain is set
if [ "$DOMAIN" != "_" ]; then
    sed -i "s/server_name _;/server_name $DOMAIN;/" /etc/nginx/conf.d/oci-calculator.conf
fi

# Remove default sites that conflict
if [ -f /etc/nginx/conf.d/default.conf ]; then
    mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.bak
fi
if [ -f /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
fi

nginx -t
systemctl enable --now nginx
systemctl reload nginx

# ── Firewall ─────────────────────────────────────────────────────────
echo "Opening firewall ports..."
if command -v firewall-cmd &>/dev/null; then
    # Oracle Linux (firewalld)
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --reload
elif command -v ufw &>/dev/null; then
    # Ubuntu (ufw)
    ufw allow 'Nginx Full'
fi

# OCI Ubuntu images have iptables rules that block traffic by default.
# Insert HTTP accept rule BEFORE the reject-all rule.
if iptables -L INPUT -n --line-numbers 2>/dev/null | grep -q "REJECT.*icmp-host-prohibited"; then
    REJECT_LINE=$(iptables -L INPUT -n --line-numbers | grep "REJECT.*icmp-host-prohibited" | awk '{print $1}')
    iptables -I INPUT "$REJECT_LINE" -m state --state NEW -p tcp --dport 80 -j ACCEPT
    iptables -I INPUT "$((REJECT_LINE + 1))" -m state --state NEW -p tcp --dport 443 -j ACCEPT
    if command -v netfilter-persistent &>/dev/null; then
        netfilter-persistent save
    fi
fi

# ── Cron Jobs ────────────────────────────────────────────────────────
echo "Setting up cron jobs..."
CRON_FILE="/etc/cron.d/oci-calculator"
cat > "$CRON_FILE" <<CRON
# Pull latest code every 15 minutes
*/15 * * * * $DEPLOY_USER cd $INSTALL_DIR && git pull --ff-only >> /var/log/oci-calculator-pull.log 2>&1

# Update pricing data daily at 2:00 AM UTC
0 2 * * * $DEPLOY_USER cd $INSTALL_DIR && bash update-prices.sh >> /var/log/oci-calculator-prices.log 2>&1
CRON
chmod 644 "$CRON_FILE"

# Create log files
touch /var/log/oci-calculator-pull.log /var/log/oci-calculator-prices.log
chown "$DEPLOY_USER":"$DEPLOY_USER" /var/log/oci-calculator-pull.log /var/log/oci-calculator-prices.log

# ── Summary ──────────────────────────────────────────────────────────
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "UNKNOWN")

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  OCI Calculator deployed successfully!"
echo ""
echo "  URL:  http://$PUBLIC_IP"
if [ "$DOMAIN" != "_" ]; then
    echo "  URL:  http://$DOMAIN  (point DNS A record to $PUBLIC_IP)"
fi
echo ""
echo "  Files:     $INSTALL_DIR"
echo "  Nginx:     /etc/nginx/conf.d/oci-calculator.conf"
echo "  Cron:      $CRON_FILE"
echo "  Logs:      /var/log/oci-calculator-pull.log"
echo "             /var/log/oci-calculator-prices.log"
echo ""
echo "  Code auto-pulls every 15 minutes."
echo "  Prices auto-update daily at 2:00 AM UTC."
echo ""
echo "  IMPORTANT: Update REPO_URL in this script before running,"
echo "  and add an OCI Security List ingress rule for port 80 (TCP)"
echo "  in the OCI Console under Networking > Virtual Cloud Networks."
echo "════════════════════════════════════════════════════════════════"
