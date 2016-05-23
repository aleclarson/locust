
module.exports = ->

  setupGlobal()

  minimist = require "minimist"
  options = minimist process.argv.slice 2

  log = require "log"
  log.indent = 2
  log.moat 1

  setupBindings log

  command = options._.shift()
  lotus
    .initialize options
    .then -> lotus.runCommand command, options
    .then -> process.exit()
    .done()

setupGlobal = ->

  global.lotus = require "./index"

  require "isDev"

  # Support 'options.lazy' for the Property class.
  require "lazy-var"

  # Support 'options.reactive' for the Property class.
  require "reactive-var"

  global.prompt = require "prompt"
  global.repl = require "repl"

setupBindings = (log) ->

  KeyBindings = require "key-bindings"

  keys = KeyBindings

    "c+ctrl": ->
      log.moat 1
      log.red "CTRL+C"
      log.moat 1
      process.exit()

    "x+ctrl": ->
      log.moat 1
      log.red "CTRL+X"
      log.moat 1
      process.exit()

  keys.stream = process.stdin
