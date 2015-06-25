
require "coffee-script/register"
{ join } = require "path"
{ isType, isKind } = require "type-utils"
{ log, color, Stack } = require "lotus-log"
NamedFunction = require "named-function"
KeyMirror = require "keymirror"
define = require "define"
merge = require "merge"
io = require "io"

Config = NamedFunction "LotusConfig", (dir = ".") ->

  unless isKind this, Config
    return new Config dir

  unless io.isDir.sync dir
    io.throw
      fatal: no
      error: Error "'#{dir}' is not a directory." 
      code: "NOT_A_DIRECTORY"
      format: formatError

  regex = /^lotus-config(\.[^\.]+)?$/
  paths = io.readDir.sync dir
  paths = io.filter.sync paths, (path) -> (regex.test path) and (io.isFile.sync dir + "/" + path)
  exports = null
  
  for path in paths
    path = join dir, path
    exports = module.optional path, (error) -> throw error if error.code isnt "REQUIRE_FAILED"
    if exports isnt null then break
  
  if exports is null
    io.throw
      fatal: no
      error: Error "Failed to find a 'lotus-config' file."
      code: "NO_LOTUS_CONFIG"
      format: merge formatError(),
        repl: { dir, config: this }
        stack: { limit: 1 }
  
  define this, ->
    @options = configurable: no, writable: no
    @
      path: path
      plugins: value: exports.plugins

    @enumerable = no
    @
      exports: value: exports

reservedPluginNames = KeyMirror ["plugins"]

formatError = ->
  stack:
    exclude: ["**/lotus/src/config.*"]
    filter: (frame) -> !frame.isEval() and !frame.isNative() and !frame.isNode()

define ->
  
  @options = configurable: no, writable: no
  
  @ module, exports: Config

  @ Config.prototype,

    loadPlugins: (iterator) ->

      unless isKind @plugins, Object
        throw Error "No plugins found." 

      isMap = isKind @plugins, Array

      promise = io.fulfill()

      io.each.sync @plugins, (path, alias) =>

        if isMap and reservedPluginNames[alias]?
          throw Error "'#{alias}' is reserved and cannot be used as a plugin name."

        plugin = module.optional path, (error) ->
          error.message = "Cannot find plugin '#{path}'." if error.code is "REQUIRE_FAILED"
          throw error
        
        unless isKind plugin, Function
          throw Error "'#{alias}' failed to export a Function."

        plugin.alias = alias
        plugin.path = path

        if isMap
          options = @exports[alias]

        unless isType options, Object
          options = @exports[alias] = {}

        promise = promise.then ->
          iterator plugin, options

      promise
