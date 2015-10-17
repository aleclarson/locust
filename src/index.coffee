
lotus = require "lotus-require"

lotus ?= {}

lotus.log = require "lotus-log"

module.exports = lotus

Object.defineProperty global, "_lotus_", get: -> lotus
