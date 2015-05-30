
define = require "define"
NamedFunction = require "named-function"
Path = require "path"
{ log, color, Stack } = require "lotus-log"
{ each, filter, isFile, isDir, readDir } = require "io"

# CoffeeScript support
require "coffee-script/register"
Stack.setup()

Config = NamedFunction "LotusConfig", (dir = ".") ->

  unless this instanceof Config
    return new Config dir

  unless isDir.sync dir
    log.throw
      error: Error "'@culprit' is not a directory." 
      culprit: dir
      fatal: no
      format: formatError

  regex = /^lotus-config(\.[^\.]+)?$/
  paths = readDir.sync dir
  paths = filter.sync paths, (path) -> (regex.test path) and (isFile.sync dir + "/" + path)
  config = null
  
  for path in paths
    path = Path.join dir, path
    config = module.optional path, (error) -> throw error if error.code isnt "REQUIRE_FAILED"
    if config isnt null then break
  
  if config is null
    log.throw
      error: Error "Failed to find a 'lotus-config' file."
      culprit: dir
      fatal: no
      format: ->
        opts = formatError()
        opts.limit = 1
        opts
  
  @path = path
  @plugins = config.plugins
  this

formatError = ->
  stack:
    exclude: ["**/lotus/src/config.*"]
    filter: (frame) -> !frame.isEval() and !frame.isNative() and !frame.isNode()

define ->
  
  @options = configurable: no, writable: no
  
  @ module, exports: Config
  
  @ Config.prototype,

    loadPlugins: (iterator) ->
      throw Error "No plugins found." unless @plugins instanceof Object
      each @plugins, (id, i, done) ->
        plugin = module.optional id, (error) ->
          error.message = "Cannot find plugin '#{id}'." if error.code is "REQUIRE_FAILED"
          throw error
        unless plugin instanceof Function
          throw Error "'#{id}' failed to export a Function."
        iterator plugin, i

  @enumerable = no
  
  @ exports,

    regex: /^lotus-config(\.[^\.]+)?$/
