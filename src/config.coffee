
require "coffee-script/register"

{ log, color, Stack } = require "lotus-log"
{ isType, isKind } = require "type-utils"
{ sync, async } = require "io"
NamedFunction = require "named-function"
KeyMirror = require "keymirror"
combine = require "combine"
define = require "define"
Path = require "path"

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

module.exports = Config

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

    json = value: json
    plugins = value: plugins
    implicitDependencies = value: implicitDependencies

    define this, ->
      @options = frozen: yes
      @ { path, plugins, implicitDependencies, json }

define Config.prototype,

  loadPlugins: (iterator) ->

    unless @plugins?
      error = Error "No plugins found."
      error.fatal = no
      return async.reject error

    promise = async.fulfill()

    aliases = if @plugins instanceof KeyMirror then @plugins._keys else Object.keys @plugins

    async.each aliases, (alias) =>

      if reservedPluginNames[alias]?
        throw Error "'#{alias}' is reserved and cannot be used as a plugin name."

      path = @plugins[alias]
      plugin = module.optional path, (error) ->
        error.message = "Cannot find plugin '#{path}'." if error.code is "REQUIRE_FAILED"
        throw error

      unless isKind plugin, Function
        throw Error "'#{alias}' failed to export a Function."

      plugin.alias = alias
      plugin.path = path
      iterator plugin, @json[alias] or {}

    .fail (error) ->
      log.error error
