
require "coffee-script/register"

{ isType, isKind, assert, assertType } = require "type-utils"

KeyMirror = require "keymirror"
Factory = require "factory"
combine = require "combine"
syncFs = require "io/sync"
define = require "define"
steal = require "steal"
sync = require "sync"
Path = require "path"
log = require "lotus-log"
Q = require "q"

Plugin = require "./Plugin"

module.exports =
Config = Factory "Lotus_Config",

  initArguments: (dir) ->

    dir = "." unless dir

    assertType dir, String

    assert (syncFs.isDir dir), {
      reason: "Lotus.Config() must be passed a directory!"
      dir
    }

    [ dir ]

  init: (dir) ->

    path = dir + "/lotus-config.coffee"

    if syncFs.isFile path
      json = module.optional path, @handleLoadError

    unless json

      path = dir + "/package.json"

      if syncFs.isFile path
        json = module.optional path, @handleLoadError
        json = json.lotus if json
        json = {} unless json

    assert (isType json, Object), {
      reason: "Lotus.Config() failed to find valid configuration!"
      dir
      path
    }

    Config.fromJSON.call this, path, json

  handleLoadError: (error) ->
    throw error if error.code isnt "REQUIRE_FAILED"

  statics:

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
