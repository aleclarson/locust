
lotus = require "./index"

require "isDev"
require "failure/global"
require "type-utils/global"

# These classes inject themselves into the Property class.
LazyVar = require "lazy-var"
ReactiveVar = require "reactive-var"

log = require "log"
log.indent = 2
log.moat 1

prompt = lazy: -> require "prompt"
repl = lazy: -> require "repl"

values = { lotus, log, LazyVar, ReactiveVar }

# These are not exposed globally.
sync = require "sync"
define = require "define"

define global, { frozen: yes }, sync.map values, (value) -> { value }

define global, { frozen: yes }, { prompt, repl }

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
