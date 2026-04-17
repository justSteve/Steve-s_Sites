var _____WB$wombat$assign$function_____=function(name){return (self._wb_wombat && self._wb_wombat.local_init && self._wb_wombat.local_init(name))||self[name];};if(!self.__WB_pmw){self.__WB_pmw=function(obj){this.__WB_source=obj;return this;}}{
let window = _____WB$wombat$assign$function_____("window");
let self = _____WB$wombat$assign$function_____("self");
let document = _____WB$wombat$assign$function_____("document");
let location = _____WB$wombat$assign$function_____("location");
let top = _____WB$wombat$assign$function_____("top");
let parent = _____WB$wombat$assign$function_____("parent");
let frames = _____WB$wombat$assign$function_____("frames");
let opens = _____WB$wombat$assign$function_____("opens");
!function(){function e(e,t){return e.className.match(new RegExp("(\\s|^)"+t+"(\\s|$)"))}function t(t,i){e(t,i)||(t.className+=" "+i)}function i(t,i){if(e(t,i)){var n=new RegExp("(\\s|^)"+i+"(\\s|$)");t.className=t.className.replace(n," ")}}function n(e,t,i){return Math.max(t,Math.min(i,e))}function o(e){var t=e.getBoundingClientRect();return{top:t.top,bottom:t.bottom,left:t.left,right:t.right,width:t.width||e.offsetWidth,height:t.height||e.offsetHeight}}function r(e,t){var i=n(Math.abs(Math.min(0,e.top)),0,e.height),o=n(e.bottom-t.height,0,e.height),r=n(Math.abs(Math.min(0,e.left)),0,e.width),l=n(e.right-t.width,0,e.width),d=e.height-i-o,s=e.width-r-l;return n(d/e.height,0,1)*n(s/e.width,0,1)}function l(e){var t=d(e),i=o(e),n=r(i,{scrollY:window.pageYOffset,scrollX:window.pageXOffset,width:window.innerWidth,height:window.innerHeight});return t===document.body?n:n>0?l(t):n}function d(e){var t=e.parentNode;return t===document.body||"scroll"===window.getComputedStyle(t).getPropertyValue("overflow")?t:d(t)}function s(){return Math.max(document.documentElement.clientHeight,document.body.scrollHeight,document.documentElement.scrollHeight,document.body.offsetHeight,document.documentElement.offsetHeight)}function u(){return window.scrollY+window.innerHeight>s()-a}function c(n){n=n||document.querySelectorAll(h?'iframe[src*="vine.co"]':"iframe");var o=Array.prototype.slice.call(n,0).filter(function(t){return e(t,"pinged")}).map(function(e){return{embed:e,visibility:l(e)}});o.sort(function(e,t){return e.visibility>t.visibility?-1:e.visibility<t.visibility?1:0});var r=o[0];if(f&&u())for(var d=1;d<o.length;d++)if(o[d].visibility===r.visibility){r=o[d];break}o.forEach(function(n){var o=n.embed,l=n.visibility;o!==r.embed&&i(o,"fully-in-view"),l>0?e(o,"in-view")||(t(o,"in-view"),o.contentWindow.postMessage("scrolledInToView","*")):e(o,"in-view")&&(i(o,"in-view"),o.contentWindow.postMessage("scrolledOutOfView","*"))}),f&&!e(r.embed,"fully-in-view")&&(t(r.embed,"fully-in-view"),r.embed.contentWindow.postMessage("fullyInView","*"))}var a=10,f=!1;if(!window.VINE_EMBEDS){window.VINE_EMBEDS=!0;var h=/vine\.co/.test(window.location.host),m=function(){return window.addEventListener?function(e,t){window.addEventListener(e,t)}:function(e,t){window.attachEvent("on"+e,t)}}();m("scroll",function(e,t){var i=null;return function(){var n=this,o=arguments;clearTimeout(i),i=setTimeout(function(){e.apply(n,o)},t)}}(c.bind(null,null),100)),m("message",function(e){if(!h||/(vine\.co|localhost|(127|0)\.0\.0\.\d)/.test(e.origin)){var n,o,r,l;try{n=e.data.split("::")}catch(n){}if(n&&(o=Array.prototype.slice.call(document.querySelectorAll("iframe"),0).filter(function(t){return t.contentWindow===e.source})[0]))if("ping"===n[0]){if(t(o,"pinged"),i(o,"in-view"),c(),o.setAttribute("frameborder",0),!o.getAttribute("data-no-clamp")){var d=document.createElement("div");o.parentElement.insertBefore(d,o);var s=o.offsetWidth,u=d.offsetWidth,a=document.body.offsetWidth;if(s>u||s>a){var m=Math.min(u,a);o.setAttribute("width",m),o.setAttribute("height",m),o.contentWindow.postMessage("widthChanged","*")}}o.contentWindow.postMessage("pong","*")}else if("height"===n[0]&&n[2])o.style.removeProperty?o.style.removeProperty("height"):o.style.removeAttribute("height"),o.height=parseInt(n[2],10);else if("userUnmute"===n[0])for(f=!0,l=document.querySelectorAll("iframe.loaded"),r=0;r<l.length;r++)l[r]!==o&&l[r].contentWindow.postMessage("unmutedOtherEmbed","*");else if("userMute"===n[0])f=!1;else if("unmute"===n[0])for(t(o,"unmuted"),l=document.querySelectorAll("iframe.loaded"),r=0;r<l.length;r++)l[r]!==o&&(i(l[r],"unmuted"),l[r].contentWindow.postMessage("mute","*"));else"loaded"===n[0]&&t(o,"loaded")}})}}();
//# sourceMappingURL=embed.map
}

/*
     FILE ARCHIVED ON 18:26:21 Oct 02, 2017 AND RETRIEVED FROM THE
     INTERNET ARCHIVE ON 22:39:47 Feb 08, 2026.
     JAVASCRIPT APPENDED BY WAYBACK MACHINE, COPYRIGHT INTERNET ARCHIVE.

     ALL OTHER CONTENT MAY ALSO BE PROTECTED BY COPYRIGHT (17 U.S.C.
     SECTION 108(a)(3)).
*/
/*
playback timings (ms):
  captures_list: 1.799
  exclusion.robots: 0.05
  exclusion.robots.policy: 0.037
  esindex: 0.01
  cdx.remote: 38.4
  LoadShardBlock: 482.496 (6)
  PetaboxLoader3.datanode: 200.919 (8)
  PetaboxLoader3.resolve: 152.811 (3)
  load_resource: 267.118 (2)
*/