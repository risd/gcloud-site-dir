var options = require( './env-options.js' )()
var { spawn } = require( 'child_process' )
var siteDir = require( '../' )
var test = require( 'tape' )

test( 'upload-directory-without-error', function ( t ) {
  t.plan( 2 )
  var counter = 0;
  var emitter = siteDir( options, function ( error ) {
    t.assert( typeof error === 'undefined', 'Upload finished without error.' )
    t.assert( counter === 3, 'Uploaded three files.')
  } )

  emitter.on( 'uploaded', function ( file ) {
    counter += 1;
  } )
} )

test( 'CLI-upload-directory-without-error', function ( t ) {
  t.plan( 1 )

  var uploader = spawn( './bin/cli', [
    options.directory,
    '--siteName',
      options.siteName,
    '--gcloud',
      options.keyFile
  ] )

  uploader.on( 'exit', function ( code ) {
    t.assert( code === 0, 'CLI exited with status code 0, no errors.' )
  } )
} )
