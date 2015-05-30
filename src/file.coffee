
{ log } = require "lotus-log"
Finder = require "finder"
define = require "define"
{ io, isFile } = require "io"
{ join, isAbsolute } = require "path"
NamedFunction = require "named-function"

File = exports = NamedFunction "File", (path, pkg) ->
  return new File path, pkg unless this instanceof File
  throw Error "'path' must be absolute." unless isAbsolute path
  throw Error "'path' must be an existing file." unless isFile.sync path
  define this, ->
    
    @options = {}
    @configurable = no
    @
      isInitialized: no

    @writable = no
    @
      pkg: pkg
      path: path
      dependers: value: {}
      dependencies: value: {}

define File.prototype, ->
  @options =
    configurable: no
    writable: no
  @
    initialize: ->
      return io.resolved() if @isInitialized
      @isInitialized = yes
      io.all [
        _findDependencies()
      ]

  @enumerable = no
  @
    _findDependencies: ->
      log.moat 1
      log "Finding the dependencies of "
      log.pink @path
      log.moat 1
      find = Finder /(^|[\(\[\s]+)require(\s|\()("|')([^"']+)("|')/gi
      find.group = 3
      io.read @path
      .then (contents) ->
        # for line in contents.split log.ln

define module, ->
  @options =
    configurable: no
    writable: no
  @ { exports }
