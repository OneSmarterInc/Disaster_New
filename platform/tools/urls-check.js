// Links must follow whatever address the platform is being reached at, so
// pointing a domain at it needs no configuration.
const { baseUrl } = require(require('path').join(__dirname,'../lib/urls.js'));
const req = (host, proto) => ({ headers: Object.assign({}, host ? { host } : {}, proto ? { 'x-forwarded-proto': proto } : {}) });

delete process.env.PUBLIC_BASE_URL;
console.log('  no setting, reached on vercel     :', baseUrl(req('disaster-new-ten.vercel.app')));
console.log('  no setting, reached on the domain :', baseUrl(req('sims.onesmarter.com')));
console.log('  a proxy chain                     :', baseUrl({ headers:{ 'x-forwarded-host':'sims.onesmarter.com, edge', 'x-forwarded-proto':'https' } }));
console.log('  local, over http                  :', baseUrl(req('localhost:3000','http')));

process.env.PUBLIC_BASE_URL = 'https://sims.onesmarter.com/';
console.log('  a setting wins, slash trimmed     :', baseUrl(req('disaster-new-ten.vercel.app')));
delete process.env.PUBLIC_BASE_URL;
console.log('  no request and no setting         :', JSON.stringify(baseUrl(null)));
