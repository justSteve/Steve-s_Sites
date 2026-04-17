var _____WB$wombat$assign$function_____=function(name){return (self._wb_wombat && self._wb_wombat.local_init && self._wb_wombat.local_init(name))||self[name];};if(!self.__WB_pmw){self.__WB_pmw=function(obj){this.__WB_source=obj;return this;}}{
let window = _____WB$wombat$assign$function_____("window");
let self = _____WB$wombat$assign$function_____("self");
let document = _____WB$wombat$assign$function_____("document");
let location = _____WB$wombat$assign$function_____("location");
let top = _____WB$wombat$assign$function_____("top");
let parent = _____WB$wombat$assign$function_____("parent");
let frames = _____WB$wombat$assign$function_____("frames");
let opens = _____WB$wombat$assign$function_____("opens");
var resizetrack = false;
var lastId = "";
var pullStat = false;
var postmsg = false;
var windowOnload = function(){
	if(window.postMessage){
		postmsg = true;
	}
	try{
		if(document.createStyleSheet) {
			document.createStyleSheet('https://web.archive.org/web/20081107074548/https://newchat.livehelper.com/Client_Chat/pullDiv.css');
		}else{
			var styles="@import url('https://web.archive.org/web/20081107074548/https://newchat.livehelper.com/Client_Chat/pullDiv.css');";
			var newSS=document.createElement('link');
			newSS.rel='stylesheet';
			newSS.href='data:text/css,'+styles;
			document.getElementsByTagName("head")[0].appendChild(newSS);
		}
	}catch(e){}	
}
windowOnload();		
function endPull1(){
	pullStat = false;
	removePull();
}
function endPull(){
	var frameval=document.getElementById("Pull_Iframe_Client_Live").contentWindow;
	frameval.postMessage("endchat","https://web.archive.org/web/20081107074548/https://newchat.livehelper.com");
	pullStat = false;
	hidePull();
	setTimeout('removePull()',60000);
}
function pullOut(){
	var frameval=document.getElementById("Pull_Iframe_Client_Live").contentWindow;
	frameval.postMessage("pullout","https://web.archive.org/web/20081107074548/https://newchat.livehelper.com");
	pullStat = false;
	hidePull();
	setTimeout('removePull()',1000);
}
function hidePull(){
	document.getElementById("pullClient").style.display='none';
}
function removePull(){
	if(!pullStat){
		document.getElementById("pullClient").innerHTML='';
	}
}
var checkForMessages = function(){
	if(pullStat){
		positionit1();
		if(location.hash != lastId){
			lastId = location.hash;
			if(lastId.indexOf('ClosePull')!=-1){
				endPull1();
			}else if(lastId.indexOf('MaxPull')!=-1){
				maxPull1();
			}else if(lastId.indexOf('MinPull')!=-1){
				minPull1();
			}
		}
	}
}
function minPull1(){
	var PullIframe=document.getElementById("PullIframe");
	if(PullIframe){
		PullIframe.height = '48px';
	}
	resizetrack = true;
}
function minPull(){
	var PullIframe=document.getElementById("PullIframe");
	var mmig = document.getElementById('mmig');
	if(PullIframe){
		PullIframe.style.display = 'none';
		mmig.src='https://web.archive.org/web/20081107074548/https://newchat.livehelper.com/Client_Chat/maximize.jpg';		
	}
	resizetrack = true;
}
function maxPull1(){
	var PullIframe=document.getElementById("PullIframe");
	if(PullIframe){
		PullIframe.height = '275px';
	}
	resizetrack = false;	
}
function maxPull(){
	var PullIframe=document.getElementById("PullIframe");
	var mmig = document.getElementById('mmig');	
	if(PullIframe){
		PullIframe.style.display = 'block';
		mmig.src='https://web.archive.org/web/20081107074548/https://newchat.livehelper.com/Client_Chat/minimize.JPG';		
	}
	resizetrack = false;	
}
function pullResize(){
	if(resizetrack){
		maxPull();
	}else{
		minPull();
	}
}
if(!postmsg){
	self.setInterval(checkForMessages, 100);
}
var lhIA=new Array();
var lhOpera=false,lhBZ=navigator.userAgent;
var	lhLN="lhMenu";
if (lhBZ.search(/Opera/) != -1)lhOpera=true ;
lhIe=(document.all)?true:false;lhNs4=(document.layers)?true:false;lhNs6=(document.getElementById && !document.all)?true:false;
lhAF=new Image(),lhCI=new Image(),lhOA=new Image(),lhWZ=new Image();
var lhCK=true,lhSF=1,lhRnd,lhC,lhG,lhP,lhBV,lhPl,lhDm,lhRf,lhTl,lhTD,lhCT,lhCR;lhAN=navigator.appName,lhBV=navigator.appVersion,lhPl=navigator.platform,lhDm=document.domain,lhRf=document.referrer,lhTl=document.title,lhPg=location.href; 
var win=null;efaqWin=null;
var lhST=window.screen.availHeight,lhSW=window.screen.availWidth,lhSD=window.screen.colorDepth; 
var lhSM=lhST+"x"+lhSW;
var lhJV,plnStr="",lhLang,lhLT,lhNow=new Date();
lhLT=lhNow.valueOf();
if (lhNs4){lhLang=navigator.language;for (pln in navigator.plugins){plnStr+=pln+",";}}
if (plnStr.length>499){plnStr=" ";}
if (lhIe){lhLang=navigator.systemLanguage; 
}
if (lhPl=="Win32"){
    var vR="";var pR="";
	if (lhOpera){
		lhAN = "Opera" ;
		vR=/.*Opera(.*)\[/;   
		pR=/.*;.*;(.*)\)/; 
		lhPl=lhBV.match(pR)[1].replace(/\sW/,"W"); 
	} else if(lhNs4) {
		vR=/(.*)\[/
		pR=/\((.*);/;   
		lhPl=pR.exec(lhBV)[1];
		lhBV=vR.exec(lhBV)[1];
	} else if(lhNs6) {
		var sy=lhBZ.split(";");
		var sz=lhBZ.split("Netscape6/");
		if (sz.length>1){sz = lhBZ.split("Netscape/");	lhBV = sz[1].replace(/\s/,"");}
		lhPl =  sy[2].replace(/\sW/,"W");
	}  else if(lhIe) {
		var srt = new String(lhBV);
		lhPl = srt.split(";")[2].replace(/\)/,"") ;
		vR = /MSIE((.)*);/										
		lhBV = srt.match(vR)[1].split(";")[0].split(" ")[1];	
	}
} 
if (!lhPg) lhPg = "local url";
function associateObjWithEvent(obj, methodName){
    return (function(e){
        e = e||window.event;
        return obj[methodName](e, this);
    });
}
function callLiveInteraction(script){
	if(script != null){
	  var excStr = script;
	  try{
		  eval(excStr);
		  setTimeout("callLiveInteraction("+ script +")",10000);
	  }
	  catch(e){}
	}
}
function lhLoadChatDirect(companyId, groupName, pageId)
{
	var protocol = "https://"; var ssl = "ENABLED";
  try{
      lh_WIN.focus();
	  if(navigator.userAgent.indexOf("IE") == -1)
		    if(lh_WIN.document == null) lh_WIN.document.open();
   }
  catch(nowindow){
	  lhHaschatted = true;
	  var name = "chat1";
	  var lhRnd = Math.random();
	  if(document.layers)
		winStatus='toolbar=no,menubar=no,directories=no,status=no,location=no,resizable=no';
	  else if(lhNs6)
		winStatus='toolbar=no,menubar=no,directories=no,status=no,location=no,resizable=no,scrollbars=yes';
	  else
		winStatus='toolbar=no,menubar=no,directories=no,status=no,location=no,resizable=no';
	
	  if(parseInt(wsz) == 1)
	  {
		lhG1 = unescape(groupName);
		var url = protocol + "newchat.livehelper.com/servlet/lhChat?ACTION=SENDNAMEENTRYSCREEN&WINDOWSIZE=1&COMPANYID=" + companyId + "&GROUPNAME=" + escape(lhG1) + "&RND=" + lhRnd + "&SSL="+ ssl +"&nocache=" + Math.random();
		lh_WIN = window.open(url, name, "width=450,height=350"+winStatus);
	  }
	  else
	  {
		lhG1 = unescape(groupName);
		var url = protocol + "newchat.livehelper.com/servlet/lhChat?ACTION=SENDNAMEENTRYSCREEN&WINDOWSIZE=0&COMPANYID=" + companyId + "&GROUPNAME=" + escape(lhG1) + "&RND=" + lhRnd + "&SSL="+ ssl +"&nocache=" + Math.random();
		lh_WIN = window.open(url, name, "width=295,height=300"+winStatus);
	  }
	   lh_WIN.focus();
  }  
}

function lhLoadEfaq(c, g, p){
	var protocol = "https://"; var ssl = "ENABLED";
	try{
		lh_Efaq.focus();
		if(navigator.userAgent.indexOf("IE") == -1)
		    if(lh_Efaq.document == null) lh_Efaq.document.open();
	}catch(e){
		var	n="efaqwin";
		var	u= protocol + "newchat.livehelper.com/servlet/lhSelfHelp?ACTION=QUESTIONENTRYSCREEN&COMPANYID=" + c+"&SSL="+ ssl;
		lh_Efaq = window.open(u,n,'width=700,height=400,toolbar=no,menubar=no,directories=no,resizable=yes, scrollbars=yes');
		lh_Efaq.focus();
	}
	
}
function lhLoadEmail(c, g, p) 
{
  var protocol = "https://"; var ssl = "ENABLED";
  try{
      lh_WIN.focus();
	  if(navigator.userAgent.indexOf("IE") == -1)
		 if(lh_WIN.document == null) lh_WIN.document.open();
   }
  catch(nowindow){
	  lhHaschatted = true;
	  var name = "email1";
	  var lhRnd = Math.random();
	  if(document.layers)
		winStatus='toolbar=no,menubar=no,directories=no,status=no,location=no,resizable=no';
	  else if(lhNs6)
		winStatus='toolbar=no,menubar=no,directories=no,status=no,location=no,resizable=no,scrollbars=yes';
	  else
		winStatus='toolbar=no,menubar=no,directories=no,status=no,location=no,resizable=no';
	
	  if(parseInt(wsz) == 1)
	  {
		lhG1 = unescape(g);
		var url = protocol + "newchat.livehelper.com/servlet/lhChat?ACTION=SENDMAIL&WINDOWSIZE=1&COMPANYID=" + c + "&GROUPNAME=" + g+"&SSL="+ ssl;
		lh_WIN = window.open(url, name, "width=450,height=350"+winStatus);
	  }
	  else
	  {
		lhG1 = unescape(g);
		var url = protocol+"newchat.livehelper.com/servlet/lhChat?ACTION=SENDMAIL&WINDOWSIZE=0&COMPANYID=" + c + "&GROUPNAME=" + g+"&SSL="+ ssl;
		lh_WIN = window.open(url, name, "width=295,height=300"+winStatus);
	  }
	  lh_WIN.focus();
  }  
}
var N6 = (document.getElementById && !document.all) ? true : false;
var lh_WIN ,lh_Efaq;
//var pageVisit = "true";
var liveEngaged = false;
var liveCount = 1;
var liveEngageUrl =null;
var wsz = null
var pullFailed = 0;
var defaultImage = new Image();
defaultImage.src = "https://web.archive.org/web/20081107074548/https://www.livehelper.com/images4/logo9].gif";
function LHBtnMsgQ(){
	var rnd =  Math.random();
	var pageVisit = "true";
	var based = null;
	var id;
	var validity = 1;
	var intervalID;
	var inVector = new Array();							
	var outVector = new Array();						
	var request = null;									
	var sending = false;								
	var lastMsg ="";
	var protocol="https://";
	var ssl = "ENABLED";
	var imgOnline = new Image();
	var imgOffline = new Image();
	var onlineText,offlineText ;
	//var windowSize=0;
	var windowSize=null;
	var imgID = Math.random();
    var isPulled = 0    ;
	var c =null; 
	var g = null;
	var op = null;
	var p = null; 
	var t = null; 
	var opStatus=2;
	var lh_PWin = null;
    var isLiveEngage = false;
	this.getValidity = function(){return  validity;}
	this.setId = function(_id){
		id = _id;
	}
	this.setParams=function(_c,_g,_op,_p,_b){
	  c = _c;  g = _g;   op = _op;  p = _p;based = _b; 
	}
	this.setOpStatus = function(obj){
		var v = obj.opstatus ;
		if(v != null)
		opStatus = parseInt(v);
		showStatus();
	}
	this.initWindowSize = function(){
		getWindowSize()
	}
	function getWindowSize(){
		 var url = protocol+ "newchat.livehelper.com/servlet/lhChat?ACTION=GETWINDOWSIZE&c="+c+"&id="+id;
		 sendCall(url);
	}
	this.setWindowSize = function(obj){
		var v = obj.windowsize ;
		if(v != null)
		windowSize = parseInt(v);
	}
	var o = this;
	var f = function(){
	var url;
	 
 url="newbrowse.livehelper.com/servlet/lhBrowse?ACTION=BTNREFRESH&RND=" + rnd + "&p=" + unescape(p) + "&c=" + escape(c) + "&b="+escape(based) + "&g=" +escape(g) +"&op="+ escape(op) +"&PAGEVISIT="+ pageVisit +"&r=" +  (Math.random() + 1 ) + "&a=" + navigator.appName + "&v=" + lhBV + "&pl=" + lhPl + "&dm=" + lhDm + "&rf=" + lhRf + "&tl=" + lhTl+ "&cs=true" + "&pg=" + lhPg + "&sd1=" + lhSM + "&sd2=" + lhSD + "&jsv=" + lhJV + "&ps=" +  plnStr + "&lot=" + lhLT + "&ll=" + lhLang + "&LC="+ liveCount+ "&pullFailed="+ pullFailed +"&nocache=" + Math.random()+"&id="+id;
		if(validity == 0){ clearInterval(intervalID);return;}
		if(pullFailed == 1)  pullFailed = 0; 
		pageVisit = "false";
	url = protocol+url; 
	 if(p !="" || t == "invisible")
	    sendCall(url);
	}
	o.intervalcheck = f; 
	this.Refresh = function(){ 	intervalID = self.setInterval(f, 15000); }
	this.SetProtocol = function(httpType){   protocol = (httpType == "ENABLED")? "https://" : "http://" ; ssl = httpType;}
	this.GetRnd = function() {return rnd;}
	this.setIconImages = function(on,off,type){
		//t = (type == "image") ? 1 : (type == "text") ? 0 : (type == "efaq")? 3 : 2 ;
		t = type;
		var _html;var buttonID;
		switch(t){
		
		case "image":  //image 
					   if(document.images){
						  if(imgOnline !=null) imgOnline.src = on;  
						  if(imgOffline !=null) imgOffline.src = off; 
						  _html = "<table border=\"0\" cellspacing=\"0\" cellpadding=\"0\"><tr><td align=\"middle\" valign=\"top\">"+
									"<img id=\""+imgID+"\" src=\""+protocol+"www.livehelper.com/images/blank.gif\" onclick=\"\" alt=\"\" />"+
									"</td></tr><tr><td id =\"pullClient\"></td></tr></table>" ;
							document.write(_html);		
							if(document.getElementById(imgID) != null)
							{
								buttonID = document.getElementById(imgID) ;
								buttonID.style.visibility ="hidden";
								buttonID.style.cursor = "pointer";
								if(defaultImage !=null)
								{
									if(imgOnline.src == defaultImage.src) buttonID.src = defaultImage.src;
									buttonID.style.visibility ="visible";
								}
								buttonID.onclick = associateObjWithEvent(this, "doOnClick");
							}
					  }
		 break;
		 // end case 
		case "text": //text
					  onlineText = on ; offlineText = off; 
					  _html = "<table border=\"0\" cellspacing=\"0\" cellpadding=\"0\"><tr><td align=\"middle\" valign=\"top\">"+
								"<a href=\"#\"><span id=\""+imgID+"\"  onclick=\"\" /></span></a>"+
								"</td></tr><tr><td id =\"pullClient\"></td></tr></table>" ;
						document.write(_html);
						if(document.getElementById(imgID) != null)
						{
							buttonID = document.getElementById(imgID) ;
							if(on != off)  buttonID.style.visibility ="hidden";
							else buttonID.innerHTML = onlineText ;
							buttonID.style.cursor = "pointer";
							buttonID.onclick = associateObjWithEvent(this, "doOnClick");
						}
						break;
		 // end case
		case "efaq" ://efaq
					if(document.images){
						imgOnline.src = on;  imgOffline.src = off; 
						_html = "<table border=\"0\" cellspacing=\"0\" cellpadding=\"0\"><tr><td align=\"middle\" valign=\"top\">"+
								"<img id=\""+imgID+"\" src=\""+protocol+"www.livehelper.com/images/blank.gif\" onclick=\"\" alt=\"\" />"+
								"</td></tr><tr><td id =\"pullClient\"></td></tr></table>" ;
						document.write(_html);		
						if(document.getElementById(imgID))
						{
							buttonID = document.getElementById(imgID) ;
							if(defaultImage !=null && defaultImage.complete)
							{
								if(imgOnline.src == defaultImage.src) 
								   buttonID.src = defaultImage.src;
								else   
								   buttonID.src = imgOnline.src;    
								buttonID.alt =  "Efaq";
							}
							buttonID.style.cursor = "pointer";
							buttonID.onclick = associateObjWithEvent(this, "bindEfaq");
						}
					}
					break;
		 // end case
		case "invisible": // invisible
						_html = "<table border=\"0\" cellspacing=\"0\" cellpadding=\"0\"><tr><td align=\"middle\" valign=\"top\">"+
								"<img id=\""+imgID+"\" src=\""+protocol+"www.livehelper.com/images/blank.gif\" onclick=\"\" alt=\"\" />"+
								"</td></tr><tr><td id =\"pullClient\"></td></tr></table>" ;
						document.write(_html);		
						if(document.getElementById(imgID) != null){
							buttonID = document.getElementById(imgID) ;
							buttonID.style.visibility ="hidden";
						}
						break;
		// end case
		default: 
			break;
		}
	}
		
 	 this.doOnClick = function(evt,elt){   if(elt.id == imgID )  lh_loadChat(); }
	 this.bindEfaq = function(evt,elt){   if(elt.id == imgID )  lh_loadEfaq(); }
	 this.getCallback = function(jData){
   		if (jData == null) {
		  return;
		}
		 if(jData.opstatus != null )  opStatus = parseInt(jData.opstatus);
		 if(jData.windowsize !=null) windowSize = parseInt(jData.windowsize);
		 if(jData.validity !=null) validity = parseInt(jData.validity) ;
		 if(jData.ispulled !=null) isPulled = parseInt(jData.ispulled);
		 showStatus();
     }
  this.callRequest = function(url){ sendCall(url);}
  function sendCall(url) {
	request = url;
	aObj = new JSONscriptRequest(request);
	aObj.buildScriptTag();
	aObj.addScriptTag();
  }
   
   function JSONscriptRequest(fullUrl) {
	  this.fullUrl = fullUrl;
	  this.noCacheIE = '&noCacheIE=' + (new Date()).getTime();
	  this.headLoc = document.getElementsByTagName("head").item(0);
	  this.scriptId = 'YJscriptId' + JSONscriptRequest.scriptCounter++;
	}

	
	JSONscriptRequest.scriptCounter = 1;
	
	JSONscriptRequest.prototype.buildScriptTag = function(){
	  this.scriptObj = document.createElement("script");
	  this.scriptObj.setAttribute("type", "text/javascript");
	  this.scriptObj.setAttribute("src", this.fullUrl + this.noCacheIE);
	  this.scriptObj.setAttribute("id", this.scriptId);
	}
	
	JSONscriptRequest.prototype.removeScriptTag = function(){
	 this.headLoc.removeChild(this.scriptObj);
	}
	
	JSONscriptRequest.prototype.addScriptTag = function(){
	  this.headLoc.appendChild(this.scriptObj);
	} 

	function showStatus() {
		switch(t){
			      case "efaq":
				              if(document.getElementById(imgID) != null){
		  						var IMG =document.getElementById(imgID);
				              	if(defaultImage.complete){
								 IMG.src =  defaultImage.src ;
								 IMG.alt =  "Efaq"; 
							   	 }
							  }
				              break;
				  case  "image" :if(document.getElementById(imgID) != null){
				                    var IMG =document.getElementById(imgID);
									if(IMG.src != defaultImage.src)
										IMG.style.visibility = (opStatus == 2)?"hidden":"visible"; 
									
									if(opStatus !=2){  
									   if(document.images){
										   if(imgOnline.src == defaultImage.src ){
												IMG.src = defaultImage.src;
												//IMG.alt = (opStatus==1) ? "Online" : "Offline"; 
										   }
										   else{ 
											   IMG.src = (opStatus==1) ? imgOnline.src : imgOffline.src;
											   //IMG.alt = (opStatus==1) ? "Online" : "Offline"; 
										   }//else
									   }//if
									}//if
				  				}
				  				break;
				  case "text" :if(document.getElementById(imgID) != null){
					                   var IMG =document.getElementById(imgID);
										IMG.style.visibility = (opStatus == 2)?"hidden":"visible"; 
										if(opStatus !=2){ 
										  IMG.innerHTML = (opStatus==1) ? onlineText : offlineText; 
										} 
				  				}
				               break;
				   case "invisible":break;
				  default :
		}
		if(isPulled == 1 ){ 	
			if(document.getElementById("pullClient")!= null){
				document.getElementById("pullClient").style.display='block';
				var loc;
				if(postmsg){
					loc = 'sendMsg';
				}else{
					loc = window.location;
				}
				var	u= protocol + "newchat.livehelper.com/servlet/lhChat?ACTION=SENDCHATSCREEN&WINDOWSIZE="+ windowSize +"&COMPANYID="+c+
						"&GROUPNAME="+escape(g)+"&CHATTYPE=Text&CLIENTNAME=Visitor&RND="+rnd+"&SSL="+ ssl +"&LOC="+loc+"&nocache=" + Math.random();
					if(postmsg){
						 document.getElementById("pullClient").innerHTML = '<div name="PullClientDiv" id="PullClientDiv" class="fixed-pullDiv">'+						  									'<div id="container" class="chatcontainer"> <b class="rtop"><b class="r2"></b><b class="r3"></b><b class="r4"></b></b>'+
										   '<table width="100%" height="5" border="0">'+
												'<tr>'+
									              '<td width="16" height="16" align="center" valign="top">'+
												  	'<img src="https://web.archive.org/web/20081107074548/https://newchat.livehelper.com/Client_Chat/green_icon.JPG" width="16" height="16" />'+
												  '</td>'+
												  '<td width="167" align="center" valign="top">'+
													'<span class="chatwith">Now Chatting With Operator</span>'+
												  '</td>'+
												  '<td width="31" align="center" valign="top">'+
													'<a href="#" onclick="pullOut();"><img src="https://web.archive.org/web/20081107074548/https://newchat.livehelper.com/Client_Chat/popout.JPG" width="15" height="15" border="0"  alt="Pop out" /></a>'+
												  '</td>'+
												  '<td width="16" align="left" valign="top" >'+
													'<a href="#" onclick="pullResize();"><img src="https://web.archive.org/web/20081107074548/https://newchat.livehelper.com/Client_Chat/minimize.JPG" alt="Minimize" width="17" height="14" border="0" id="mmig"/></a>'+
												  '</td>'+
												  '<td width="19" align="left" valign="top">'+
													'<a href="#" onclick="endPull();"><img src="https://web.archive.org/web/20081107074548/https://newchat.livehelper.com/Client_Chat/close.jpg" alt="Close" width="14" height="13" border="0" /></a>'+
												  '</td>'+
												'</tr>'+
										'</table>'+
									  '</div>'+
									  '<div class="chat_answer" id="PullIframe">'+
										 '<iframe frameborder="0" src='+u+' width="268" height="232" scrolling="no" id="Pull_Iframe_Client_Live">'+
										 '</iframe>'+
									  '</div>'+
					              '</div>';	
					}else{
						 document.getElementById("pullClient").innerHTML = '<div name="PullClientDiv" id="PullClientDiv" class="fixed-pullDiv">'+		  							      '<iframe frameborder="0" src='+u+' width="290" height="275" id="PullIframe">'+
								  '</iframe>'+ 							 
					              '</div>';	
					}
					pullStat = true;		  
				isPulled = 0;
			}
	   }
	}
function lh_loadEfaq(){
	try{
		lh_Efaq.focus();
		if(navigator.userAgent.indexOf("IE") == -1)
		if(lh_Efaq.document == null) lh_Efaq.document.open();
	}catch(e){
		var	n="efaqwin";
		var	u= protocol + "newchat.livehelper.com/servlet/lhSelfHelp?ACTION=QUESTIONENTRYSCREEN&COMPANYID=" + c+"&SSL="+ ssl;
		lh_Efaq = window.open(u,n,'width=700,height=400,toolbar=no,menubar=no,directories=no,resizable=yes, scrollbars=yes');
		lh_Efaq.focus();
	}
}
function lh_loadChat(){ 
   try{
		 lh_WIN.focus();  
		 if(navigator.userAgent.indexOf("IE") == -1)
			if(lh_WIN.document == null) lh_WIN.document.open()
	}
	catch(nowindow){
		var name = "chat1";	var lhRnd = Math.random();
		if(document.layers)
			winStatus='toolbar=no,menubar=no,directories=no,status=no,location=no,resizable=no';
		else if(lhNs6)
			winStatus='toolbar=no,menubar=no,directories=no,status=no,location=no,resizable=no,scrollbars=yes';
		else
			winStatus='toolbar=no,menubar=no,directories=no,status=no,location=no,resizable=no';
		var action;	
		
		if( based == "operator")  action = "SENDNAMEENTRYSCREENOPERATOR";
		else if(based == "group")  action = "SENDNAMEENTRYSCREENGROUP";		
		else  action = "SENDNAMEENTRYSCREEN";

		
		if(parseInt(windowSize) == 1)
		{
			var url = protocol + "newchat.livehelper.com/servlet/lhChat?ACTION="+action+"&WINDOWSIZE=1&COMPANYID=" + c + 
					  "&GROUPNAME=" + unescape(g) + "&OPERATOR="+ unescape(op)+
					  "&RND=" + lhRnd + "&SSL="+ ssl +"&nocache=" + Math.random();
			lh_WIN = window.open(url, name, "width=450,height=350"+winStatus);
		}
		else{
			var url1 = protocol + "newchat.livehelper.com/servlet/lhChat?ACTION="+action+"&WINDOWSIZE=0&COMPANYID=" + c + 
					  "&GROUPNAME=" + unescape(g) + "&OPERATOR="+ unescape(op)+
					  "&RND=" + lhRnd + "&SSL="+ ssl +"&nocache=" + Math.random();
			lh_WIN = window.open(url1, name, "width=295,height=300"+winStatus);
		}
		 lh_WIN.focus();  
		}
    }
}	

var pool = new Array();
var l = 0;
function createButtonImage(c,g,op,p,o,z,t,b){
	var lhBtnMsg = new LHBtnMsgQ();
	if(lhBtnMsg){
		
		var protocol = "https://";
		lhBtnMsg.SetProtocol("ENABLED");
		lhBtnMsg.setParams(c,g,op,p,b);
		var  url = "newbrowse.livehelper.com/servlet/lhBrowse?ACTION=BTNINIT&c="+escape(c)+ "&b="+escape(b)+"&g="+escape(g)+"&op="+escape(op)+"&p="+unescape(p)+"&RND=" + lhBtnMsg.GetRnd() +"&nocache=" + Math.random()+"&id="+l;
			
	    url = protocol + url;
		//var norefresh = false;
		if(z == "" && o == "" && (t == "image" || t == "efaq")){ 
		    z = defaultImage.src; o = z;
		 }
	     lhBtnMsg.setIconImages(o,z,t);
		 lhBtnMsg.setId( l++) ; 
          pool.push(lhBtnMsg);
		  if(p !="" || t == "invisible")
		    lhBtnMsg.callRequest(url);  // Send BTNINIT
		  lhBtnMsg.Refresh();
	}
}
function setIcon(c, g, p){
 createButtonImage(c,g,escape(""),p,"","","image",null);
}
function setIcon_NoTracker(c,g,p){
 createButtonImage(c,g,"",p,"","","image",null);
}
function setIconImg(c,g,p,i){
  createButtonImage(c,g,"",p,i,i,"image","company");
}
function setIconStatusGroup(c,g,p,o,z,t){
   createButtonImage(c,g,"",p,o,z,"image","group");
}

function setIconStatusGroup_NoTracker(c,g,p,o,z,t){
   createButtonImage(c,g,"",p,o,z,"image","group");
}
function setIconStatusOperator(c,g,r,p,o,z,t){
 createButtonImage(c,g,r,p,o,z,"image","operator");
}
function setIconStatusOperator_NoTracker(c,g,r,p,o,z,t){
  createButtonImage(c,g,r,p,o,z,"image","operator");	
}
function setIconBsyImg(c,g,p,o,z,t){
  if(t == "text" && o == z)	
    createButtonImage(c,g,"",p,o,z,"text","company");
  else if(t != "text")	
  	createButtonImage(c,g,"",p,o,z,"image","company");	   	
}
function setIconBsyImg_NoTracker(c,g,p,o,z,t){
   if(t == "text")	
    createButtonImage(c,g,"",p,o,z,"text","company");
  else	
  	createButtonImage(c,g,"",p,o,z,"image","company");
}
function setIconTextNew(c,g,p,o,z){
  createButtonImage(c,g,"",p,o,z,"text","company");	
}
function setIconText(c,g,p,t){
  setIconTextNew(c,g,p,t,t) ;
}
function setIconInvisible(c,g,p){
  if (!g)	g="	";
  createButtonImage(c,escape(g),"",p,"","","invisible",null);	
}
function setIconEfaq(c,	g, p){
	createButtonImage(c,g,"",p,"","","efaq",null);	
}
function setIconBrowse(c,g,p){
 createButtonImage(c,g,"",p,"","","image","company");	
}
function lhSendInfoTag(CID,name,value){
	var IPAdd = "newbrowse.livehelper.com" ;
	var str = "https://" + IPAdd + "/servlet/lhBrowse?ACTION=INFOTAG&" ;
	var len = arguments.length;
	if ( len <= 1 || len%2 == 0) { 
		return; 	
	}
	var tagstr = "";
	for (i=1 ; i<len ; i+=2) {
		tagstr +=  escape(arguments[i]) + escape("^") + escape(arguments[i+1]) + escape(";"); 
	}
	str += "C=" + CID  + "&TAGDATA=" + tagstr;
	var img = new Image();
	var str1 = str;
	img.src = str1; 
	return;
}

}

/*
     FILE ARCHIVED ON 07:45:48 Nov 07, 2008 AND RETRIEVED FROM THE
     INTERNET ARCHIVE ON 13:57:23 Mar 22, 2026.
     JAVASCRIPT APPENDED BY WAYBACK MACHINE, COPYRIGHT INTERNET ARCHIVE.

     ALL OTHER CONTENT MAY ALSO BE PROTECTED BY COPYRIGHT (17 U.S.C.
     SECTION 108(a)(3)).
*/
/*
playback timings (ms):
  captures_list: 0.622
  exclusion.robots: 0.059
  exclusion.robots.policy: 0.048
  esindex: 0.01
  cdx.remote: 8.382
  LoadShardBlock: 122.417 (3)
  PetaboxLoader3.datanode: 61.533 (4)
  PetaboxLoader3.resolve: 99.72 (3)
  load_resource: 73.101
*/