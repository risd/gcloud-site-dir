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

**directory** the directory to upload.

**siteName** the name of the bucket to create and configure as a site on Google Cloud Storage.

**keyFile** the Google Cloud Storage JSON file for the Google Cloud Project.

### [CLI Options](bin/cli-help.txt)
