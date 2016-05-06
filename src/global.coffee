
lotus = require "./index"
lotus.forceAll = yes

log = require "lotus-log"
# log.clear()
log.indent = 2
log.moat 1

combine = require "combine"
define = require "define"

combine global, {
  log
  lotus
  isDev: require "isDev"
  emptyFunction: require "emptyFunction"
  sync: require "sync"
  Q: require "q"
}

combine global, props for props in [
  require "type-utils"
]

define global, {
  repl: lazy: -> require "lotus-repl"
}
