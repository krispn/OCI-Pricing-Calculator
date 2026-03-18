@echo off
echo Fetching OCI pricing data...
echo.

set DATA_DIR=%~dp0data

echo   Downloading products...
curl -s "https://apexapps.oracle.com/pls/apex/cetools/api/v1/products/?currencyCode=USD" -o "%DATA_DIR%\products-raw.json"

echo   Downloading shapes...
curl -s "https://www.oracle.com/a/ocom/docs/cloudestimator2/data/shapes.json" -o "%DATA_DIR%\shapes.json"

echo   Building snapshot...
python -c "import json,os,sys;from datetime import datetime;data_dir=r'%DATA_DIR%';pf=open(os.path.join(data_dir,'products-raw.json'));pd=json.load(pf);pf.close();prices={};[prices.update({item['partNumber']:{p['model']:float(p.get('value',0)) for p in curr.get('prices',[])}}) for item in pd.get('items',[]) for curr in item.get('currencyCodeLocalizations',[]) if curr['currencyCode']=='USD'];sf=open(os.path.join(data_dir,'shapes.json'));sd=json.load(sf);sf.close();shapes=sd.get('items',sd) if isinstance(sd,dict) else sd;bid=sd.get('buildId') if isinstance(sd,dict) else None;snap={'timestamp':pd.get('lastUpdated',''),'fetchedAt':datetime.utcnow().isoformat()+'Z','prices':prices,'shapes':shapes,'buildId':bid};of=open(os.path.join(data_dir,'pricing-snapshot.json'),'w');json.dump(snap,of);of.close();os.remove(os.path.join(data_dir,'products-raw.json'));os.remove(os.path.join(data_dir,'shapes.json'));print(f'  {len(prices)} SKUs, {len(shapes)} shapes loaded')"

echo.
echo Done! Pricing data updated. Refresh your browser to see new prices.
pause
