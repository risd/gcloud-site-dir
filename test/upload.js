var options = require( './env-options.js' )()
var siteDir = require( '../' )
var test = require( 'tape' )

// × setup dotenv to read .env.test
// write the test function
// run the test
// commit changes
// update risd/webhook to reference this
// close out https://github.com/risd/edu/issues/642

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
