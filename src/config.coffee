
require "coffee-script/register"
Stack = require "stack"
Stack.initialize()

{ isType, isKind, assertType } = require "type-utils"
{ sync, async } = require "io"
{ log, color } = require "lotus-log"
NamedFunction = require "named-function"
KeyMirror = require "keymirror"
combine = require "combine"
define = require "define"
Path = require "path"

module.exports =
Config = NamedFunction "LotusConfig", (dir = ".") ->

  unless isKind this, Config
    return new Config dir

  unless sync.isDir dir
    async.throw
      fatal: no
      error: Error "'#{dir}' is not a directory."
      code: "NOT_A_DIRECTORY"
      format: formatError

  regex = /^lotus-config(\.[^\.]+)?$/
  paths = sync.readDir dir
  paths = sync.filter paths, (path) -> (regex.test path) and (sync.isFile dir + "/" + path)
  json = null

  for path in paths
    path = Path.join dir, path
    json = module.optional path, (error) -> throw error if error.code isnt "REQUIRE_FAILED"
    if json isnt null then break

  if json is null
    async.throw
      fatal: no
      error: Error "Failed to find a 'lotus-config' file."
      code: "NO_LOTUS_CONFIG"
      format: combine formatError(),
        repl: { dir, config: this }
        stack: { limit: 1 }

  Config.fromJSON.call this, path, json

reservedPluginNames = KeyMirror ["plugins"]

formatError = ->
  stack:
    exclude: ["**/lotus/src/config.*"]
    filter: (frame) -> !frame.isEval() and !frame.isNative() and !frame.isNode()

define Config,

  fromJSON: (path, json) ->

    unless isKind this, Config
      config = Object.create Config.prototype
      return Config.fromJSON.call config, path, json

    { plugins, implicitDependencies } = json

    if isKind plugins, Array
      plugins = KeyMirror plugins

    define this, ->
      @frozen = yes
      @
        path: path
        json: { value: json }
        plugins: { value: plugins }
        implicitDependencies: { value: implicitDependencies }

define Config.prototype,

  addPlugins: (plugins) ->
    assertType plugins, Object
    @plugins ?= {}
    @plugins._add plugins if @plugins instanceof KeyMirror
    @plugins[key] = plugin for key, plugin of plugins

  loadPlugins: (iterator) ->

    unless @plugins?
      error = Error "No plugins found."
      error.fatal = no
      return async.reject error

    promise = async.fulfill()

    aliases =
      if @plugins instanceof KeyMirror then @plugins._keys
      else Object.keys @plugins

    async.each aliases, (alias) =>

      if reservedPluginNames[alias]?
        throw Error "'#{alias}' is reserved and cannot be used as a plugin name."

      path = @plugins[alias]

      if isType path, String
        plugin = module.optional path, (error) ->
          error.message = "Cannot find plugin '#{path}'." if error.code is "REQUIRE_FAILED"
          throw error
        plugin.path = path

      else if isType path, Function
        plugin = path

      unless isKind plugin, Function
        throw Error "'#{alias}' failed to export a Function."

      plugin.alias = alias
      async.try =>
        iterator plugin, @json[alias] or {}
      .fail (error) =>
        log
          .moat 1
          .red alias
          .moat 0
          .white error.message
          .moat 1

    .fail (error) ->
      log.error error
