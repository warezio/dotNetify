/* 
Copyright 2017 Dicky Suryadi

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 */

var signalRSelector = {
   _netfx: require('./no-jquery.signalR'),
   _netcore: require('@aspnet/signalr-client'),
   _default: null,
   netfx: function () { signalRSelector._default = signalRSelector._netfx; }
};

Object.defineProperty(signalRSelector, "default", {
   get: function () { return signalRSelector._default || signalRSelector._netcore; },
});

if (typeof window !== "undefined")
   window.signalR = window.signalR || signalRSelector.lib;

if (typeof exports === "object" && typeof module === "object")
   module.exports = signalRSelector;