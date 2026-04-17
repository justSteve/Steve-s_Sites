var _____WB$wombat$assign$function_____=function(name){return (self._wb_wombat && self._wb_wombat.local_init && self._wb_wombat.local_init(name))||self[name];};if(!self.__WB_pmw){self.__WB_pmw=function(obj){this.__WB_source=obj;return this;}}{
let window = _____WB$wombat$assign$function_____("window");
let self = _____WB$wombat$assign$function_____("self");
let document = _____WB$wombat$assign$function_____("document");
let location = _____WB$wombat$assign$function_____("location");
let top = _____WB$wombat$assign$function_____("top");
let parent = _____WB$wombat$assign$function_____("parent");
let frames = _____WB$wombat$assign$function_____("frames");
let opens = _____WB$wombat$assign$function_____("opens");


$(function () {

    $("#showLoginBox").dialog({
        autoOpen: false,
        height: 300,
        width: 350,
        modal: true
    });

    $("#login-user")
			.button()
			.click(function () {
			    $("#showLoginBox").dialog("open");

			});

    // define function that opens the overlay

    var form = $("#loginForm");
    form.submit(function () {
        var data = form.serialize();
        $.post(form.attr("action"), data, function (result, status) {
            if (result.Success) {
                $("#showLoginBox").dialog("close");
                //                if (result.ErrorMessage == null) {
                //                    $("#showLoginBox").dialog("close");
                ////                } else {
                ////                    $("#emailDefPass").val(result.ErrorMessage);
                ////                    $("#showLoginBox .container").hide();
                ////                    $("#showLoginBox .resetPasswordRequestContainer").show();
                //                }
                //Show user name
                $.ajax({
                    url: "/Account/ShowLoginStatus",
                    cache: false,
                    success: function (html) {
                        $(".showLoggedUser").html(html);
                    }
                });

                //Show user menu if navigation block is present
                if ($("#menu").length > 0) {
                    $.ajax({
                        url: "/Account/ShowUserMenu",
                        cache: false,
                        success: function (html) {
                            $("#menu").append(html);
                        }
                    });
                    if (result.UserType == "Admin") {

                        window.location = "/Admin";
                    }

                    if (result.UserType == "Affiliate") {
                        //alert("is affiliate");                        
                        window.location = "/Affiliate";
                    }
                    if (result.UserType == "Customer") {
                        //alert("is user");                        
                        window.location = "/Account/MyWebinars";
                    }
                }

            } else {
                $('.loginErrors').html(result.ErrorMessage);
            }
        }, "json");
        return false;
    });

    $("#showLoginBox .lostPasswordButton").click(function () {
        $("#showLoginBox .container").hide();
        $("#showLoginBox .lostPasswordContainer").show();
        return false;
    });

    $("#showLoginBox .loginButton").click(function () {

        $("#showLoginBox .container").hide();
        $("#showLoginBox .loginContainer").show();
        return false;
    });

    var lostPasswordForm = $("#lostPasswordForm");
    lostPasswordForm.submit(function () {
        var data = lostPasswordForm.serialize();
        $.post(lostPasswordForm.attr("action"), data, function (result, status) {
            if (result.Success) {
                $("#showLoginBox .container").hide();
                $("#showLoginBox .passwordSentContainer").show();
            } else {
                $("#showLoginBox .container").hide();
                $("#showLoginBox .noAccountFoundContainer").show();
            }
        }, "json");
        return false;
    });

    //passwordReset Work / 1/12
    $("#showLoginBox .resetPasswordButton").click(function () {
        $("#showLoginBox .container").hide();
        $("#showLoginBox .resetPasswordContainer").show();
        return false;
    });

    var resetPasswordForm = $("#resetPasswordForm");
    resetPasswordForm.submit(function () {
        var data = resetPasswordForm.serialize();
        $.post(resetPasswordForm.attr("action"), data, function (result, status) {
            if (result.Success) {
                $("#showLoginBox .container").hide();
                $("#showLoginBox .passwordWasResetContainer").show();
            } else {
                $("#showLoginBox .container").hide();
                $("#showLoginBox .passwordResetErrorContainer").show();
            }
        }, "json");
        return false;
    });


});

}

/*
     FILE ARCHIVED ON 02:13:17 Jul 24, 2013 AND RETRIEVED FROM THE
     INTERNET ARCHIVE ON 14:01:02 Mar 22, 2026.
     JAVASCRIPT APPENDED BY WAYBACK MACHINE, COPYRIGHT INTERNET ARCHIVE.

     ALL OTHER CONTENT MAY ALSO BE PROTECTED BY COPYRIGHT (17 U.S.C.
     SECTION 108(a)(3)).
*/
/*
playback timings (ms):
  captures_list: 0.859
  exclusion.robots: 0.093
  exclusion.robots.policy: 0.079
  esindex: 0.013
  cdx.remote: 57.475
  LoadShardBlock: 204.776 (3)
  PetaboxLoader3.datanode: 196.15 (4)
  load_resource: 43.324
*/