var EXPORTED_SYMBOLS = [];

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

Cu.import("resource://conversations/hook.js");
Cu.import("resource://conversations/log.js");
Cu.import("resource://conversations/misc.js");


let Log = setupLogging("Conversations.Modules.VirtualIdentity");

let window = getMail3Pane()

let virtualIdentityHook = {
  onComposeFieldsChanged: function _virtualIdentityHook_onComposeFieldsChanged(recipients, params, senderNameElem) {
    window.virtualIdentityExtension.conversationHook.onComposeFieldsChanged(recipients, params, senderNameElem, Log);
  },
  
  onMessageBeforeSendOrPopup: function _enigmailHook_onMessageBeforeSendOrPopup(params, recipients, popOut, aStatus) {
    // returns true if message should be sended, false if sending should be aborted
    return window.virtualIdentityExtension.conversationHook.onMessageBeforeSendOrPopup(params, recipients, popOut, aStatus, Log);
  },
  
  onStopSending: function _virtualIdentityHook_onStopSending() {
    window.virtualIdentityExtension.conversationHook.onStopSending();
  },
  
  onRecipientAdded: function _virtualIdentityHook_onRecipientAdded(recipient, type, count) {
    window.virtualIdentityExtension.conversationHook.onRecipientAdded(recipient, type, count, Log);
  }
}

// virtual Identity support
let hasVirtualIdentity;
window.addEventListener("load", function () {
  hasVirtualIdentity = (("virtualIdentityExtension" in window) && typeof(window.virtualIdentityExtension) == "object");
  if (hasVirtualIdentity) {
    Log.debug("Virtual Identity plugin for Thunderbird Conversations loaded!");
    registerHook(virtualIdentityHook);
  }
  else Log.debug("Virtual Identity doesn't seem to be installed...");
}, false);