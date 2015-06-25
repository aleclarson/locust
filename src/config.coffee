
require "coffee-script/register"

{ isType, assert, assertType } = require "type-utils"

syncFs = require "io/sync"
steal = require "steal"
Type = require "Type"
sync = require "sync"

Plugin = require "./Plugin"

type = Type "Lotus_Config"

type.argumentTypes =
  dir: String.Maybe

type.initInstance (dir) ->

  dir = "." unless dir

  assert syncFs.isDir(dir),
    reason: "Expected an existing directory!"
    dir: dir

  path = dir + "/lotus-config.coffee"

  if syncFs.isFile path
    json = module.optional path, (error) ->
      log.moat 1
      log.white "Failed to require: "
      log.red path
      log.moat 1
      log.gray.dim error.stack
      log.moat 1

  unless json

    path = dir + "/package.json"

    if syncFs.isFile path
      json = module.optional path, (error) ->
        log.moat 1
        log.white "Failed to require: "
        log.red path
        log.moat 1
        log.gray.dim error.stack
        log.moat 1
      json = json.lotus if json
      json = {} unless json

  assert isType(json, Object),
    reason: "Failed to find configuration file!"
    dir: dir
    path: path

  Config.fromJSON.call this, path, json

type.defineMethods

  _onRequireError: (error) ->
    throw error if error.code isnt "REQUIRE_FAILED"

type.defineStatics

  fromJSON: (path, json) ->

    unless this instanceof Config
      config = Object.create Config.prototype
      return Config.fromJSON.call config, path, json

    plugins = json.plugins ?= []
    try assertType plugins, Array.Maybe
    catch error then repl.sync (c) => eval c

    @path = path
    @plugins = plugins
    @implicitDependencies = steal json, "implicitDependencies"
    @json = json
    return this

module.exports = Config = type.build()
