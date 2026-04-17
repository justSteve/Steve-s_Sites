var _____WB$wombat$assign$function_____=function(name){return (self._wb_wombat && self._wb_wombat.local_init && self._wb_wombat.local_init(name))||self[name];};if(!self.__WB_pmw){self.__WB_pmw=function(obj){this.__WB_source=obj;return this;}}{
let window = _____WB$wombat$assign$function_____("window");
let self = _____WB$wombat$assign$function_____("self");
let document = _____WB$wombat$assign$function_____("document");
let location = _____WB$wombat$assign$function_____("location");
let top = _____WB$wombat$assign$function_____("top");
let parent = _____WB$wombat$assign$function_____("parent");
let frames = _____WB$wombat$assign$function_____("frames");
let opens = _____WB$wombat$assign$function_____("opens");
!function(){function e(e,t){var i=null;return function(){var n=this,o=arguments;clearTimeout(i),i=setTimeout(function(){e.apply(n,o)},t)}}function t(e,t){return e.className.match(new RegExp("(\\s|^)"+t+"(\\s|$)"))}function i(e,i){t(e,i)||(e.className+=" "+i)}function n(e,i){if(t(e,i)){var n=new RegExp("(\\s|^)"+i+"(\\s|$)");e.className=e.className.replace(n," ")}}function o(e,t,i){return Math.max(t,Math.min(i,e))}function r(e){var t=e.getBoundingClientRect();return{top:t.top,bottom:t.bottom,left:t.left,right:t.right,width:t.width||e.offsetWidth,height:t.height||e.offsetHeight}}function l(e,t){var i=o(Math.abs(Math.min(0,e.top)),0,e.height),n=o(e.bottom-t.height,0,e.height),r=o(Math.abs(Math.min(0,e.left)),0,e.width),l=o(e.right-t.width,0,e.width),d=e.height-i-n,s=e.width-r-l,u=o(d/e.height,0,1),c=o(s/e.width,0,1);return u*c}function d(e){var t=s(e),i=r(e),n=l(i,{scrollY:window.pageYOffset,scrollX:window.pageXOffset,width:window.innerWidth,height:window.innerHeight});return t===document.body?n:n>0?d(t):n}function s(e){var t=e.parentNode;return t===document.body||"scroll"===window.getComputedStyle(t).getPropertyValue("overflow")?t:s(t)}function u(){return Math.max(document.documentElement.clientHeight,document.body.scrollHeight,document.documentElement.scrollHeight,document.body.offsetHeight,document.documentElement.offsetHeight)}function c(){return window.scrollY+window.innerHeight>u()-f}function a(e){e=e||document.querySelectorAll(m?'iframe[src*="vine.co"]':"iframe");var o=Array.prototype.slice.call(e,0).filter(function(e){return t(e,"pinged")}).map(function(e){return{embed:e,visibility:d(e)}});o.sort(function(e,t){return e.visibility>t.visibility?-1:e.visibility<t.visibility?1:0});var r=o[0];if(h&&c())for(var l=1;l<o.length;l++)if(o[l].visibility===r.visibility){r=o[l];break}o.forEach(function(e){var o=e.embed,l=e.visibility;o!==r.embed&&n(o,"fully-in-view"),l>0?t(o,"in-view")||(i(o,"in-view"),o.contentWindow.postMessage("scrolledInToView","*")):t(o,"in-view")&&(n(o,"in-view"),o.contentWindow.postMessage("scrolledOutOfView","*"))}),h&&!t(r.embed,"fully-in-view")&&(i(r.embed,"fully-in-view"),r.embed.contentWindow.postMessage("fullyInView","*"))}var f=10,h=!1;if(!window.VINE_EMBEDS){window.VINE_EMBEDS=!0;var m=/vine\.co/.test(window.location.host),w=function(){return window.addEventListener?function(e,t){window.addEventListener(e,t)}:function(e,t){window.attachEvent("on"+e,t)}}();w("scroll",e(a.bind(null,null),100)),w("message",function(e){if(!m||/(vine\.co|localhost|(127|0)\.0\.0\.\d)/.test(e.origin)){var t,o,r,l;try{t=e.data.split("::")}catch(t){}if(t&&(o=Array.prototype.slice.call(document.querySelectorAll("iframe"),0).filter(function(t){return t.contentWindow===e.source})[0]))if("ping"===t[0]){if(i(o,"pinged"),n(o,"in-view"),a(),o.setAttribute("frameborder",0),!o.getAttribute("data-no-clamp")){var d=document.createElement("div");o.parentElement.insertBefore(d,o);var s=o.offsetWidth,u=d.offsetWidth,c=document.body.offsetWidth;if(s>u||s>c){var f=Math.min(u,c);o.setAttribute("width",f),o.setAttribute("height",f),o.contentWindow.postMessage("widthChanged","*")}}o.contentWindow.postMessage("pong","*")}else if("height"===t[0]&&t[2])o.style.removeProperty?o.style.removeProperty("height"):o.style.removeAttribute("height"),o.height=parseInt(t[2],10);else if("userUnmute"===t[0])for(h=!0,l=document.querySelectorAll("iframe.loaded"),r=0;r<l.length;r++)l[r]!==o&&l[r].contentWindow.postMessage("unmutedOtherEmbed","*");else if("userMute"===t[0])h=!1;else if("unmute"===t[0])for(i(o,"unmuted"),l=document.querySelectorAll("iframe.loaded"),r=0;r<l.length;r++)l[r]!==o&&(n(l[r],"unmuted"),l[r].contentWindow.postMessage("mute","*"));else"loaded"===t[0]&&i(o,"loaded")}})}}();
//# sourceMappingURL=embed.map
}

/*
     FILE ARCHIVED ON 20:40:09 May 14, 2016 AND RETRIEVED FROM THE
     INTERNET ARCHIVE ON 22:36:07 Feb 08, 2026.
     JAVASCRIPT APPENDED BY WAYBACK MACHINE, COPYRIGHT INTERNET ARCHIVE.

     ALL OTHER CONTENT MAY ALSO BE PROTECTED BY COPYRIGHT (17 U.S.C.
     SECTION 108(a)(3)).
*/
/*
playback timings (ms):
  captures_list: 0.508
  exclusion.robots: 0.036
  exclusion.robots.policy: 0.028
  esindex: 0.009
  cdx.remote: 17.456
  LoadShardBlock: 1392.077 (3)
  PetaboxLoader3.datanode: 1399.959 (4)
  load_resource: 151.803
  PetaboxLoader3.resolve: 104.838
*/