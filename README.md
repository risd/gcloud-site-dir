# gcloud-site-dir

To install: `npm install gcloud-site-dir`

To use in Node.js

```
var gcloudSiteDir = require( 'gcloud-site-dir' )
var options = {
  directory: 'build',
  siteName: archive.risd.systems,
  keyFile: ~/configuration/gcloud.json,
}
gcloudSiteDir( options, function ( error ) {
  if ( error ) throw error;
} )
```

To use at the command line: `gcloud-site-dir build --siteName=archive.risd.systems --gcloud=~/configuration/gcloud.json`

### Node Options

**directory** the directory to upload. Required.

**siteName** the name of the bucket to create and configure as a site on Google Cloud Storage. Required.

**keyFile** the Google Cloud Storage JSON file for the Google Cloud Project. Required.

**directoryPrefix** the prefix to prepend to the path of each file. Optional.

**gitSuffix** if true, will suffix the subdomain `siteName` with the current `git` branch.

**gitSubdomain** if true, will prefix the `siteName` with a subdomain of the current `git` branch

### [CLI Options](bin/cli-help.txt)

### Testing

`npm test`. Testing is done via [tape](https://www.npmjs.com/package/tape) & configured with [dotenv-safe](https://www.npmjs.com/package/dotenv-safe). The [`.env.test.example`](/.env.test.example) file should be duplicated and modified as `.env.test`. This will get used to run the tests.
