
lotus = require "lotus-require"
lotus.forceAll = yes

combine = require "combine"
define = require "define"

define global, {
  repl: lazy: -> require "lotus-repl"
}

combine global, {
  lotus
  log: require "lotus-log"
  emptyFunction: require "emptyFunction"
}

combine global, props for props in [
  require "type-utils"
  require "io"
]

combine global, {
  File: require "./File"
  Module: require "./Module"
}
