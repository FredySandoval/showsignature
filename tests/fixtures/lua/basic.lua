local json = require("json")
http = require "socket.http"

-- module comment
--[[
block comment
]]

local VERSION = "1.0"
Config = { enabled = true }

local function helper(value)
  return value
end

function greet(name)
  return "hi " .. name
end

User = {}
function User:new(id)
  return { id = id }
end

run = function(opts)
  return opts
end
