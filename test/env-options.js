var path = require( 'path' )

module.exports = EnvOptions;

function EnvOptions ( options ) {
  if ( ! ( this instanceof EnvOptions ) ) return new EnvOptions( options )
  if ( typeof options !== 'object' ) options = {}

  require( 'dotenv-safe' ).load( {
    allowEmptyValues: true,
    path: path.join( process.cwd(), '.env.test' ),
    sample: path.join( process.cwd(), '.env.test.example' ),
  } )

  var envOptions = {
    keyFile: process.env.KEY_FILE,
    siteName: process.env.SITE_NAME,
    directory: process.env.DIRECTORY,
    directoryPrefix: process.env.DIRECTORY_PREFIX,
    gitSuffix: process.env.GIT_SUFFIX,
    gitSubdomain: process.env.GIT_SUBDOMAIN,
  }

  Object.assign( envOptions, options )

  Object.keys( envOptions ).forEach( undefinedIfEmptyString( envOptions ) )

  return envOptions;

  function undefinedIfEmptyString ( object ) {
    return function forKey ( key ) {
      var value = object[ key ]
      if ( typeof value === 'string' && value.length === 0 ) object[ key ] = undefined; 
    }
  }
}
