
lotus = require "./index"
lotus.forceAll = yes

require "failure/global"

# These classes inject themselves into the Property class.
require "lazy-var"
require "reactive-var"

combine = require "combine"
define = require "define"

log = require "log"
# log.clear()
log.indent = 2
log.moat 1

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
