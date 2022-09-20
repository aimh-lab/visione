/*
 * Author: Sławomir Netteria.NET https://netteria.net
 */
(function ($) {

    $.fn.VideoPopUp = function (options) {
        
        var defaults = {
            backgroundColor: "#000000",
            opener: "video",
            maxweight: "640",
            pausevideo: false,
            idvideo: ""
        };
        
        var patter = this.attr('id');

        var settings = $.extend({}, defaults, options);

        var video = document.getElementById(settings.idvideo);
        function stopVideo() {
            var tag = $('#' + patter + '').get(0).tagName;
            if (tag == 'video') {
                video.pause();
                video.currentTime = 0;
            }
        }
        
        $('#' + patter + '').css("display", "none");
        $('#' + patter + '').append('<div id="opct"></div>');
        $('#opct').css("background", settings.backgroundColor);
        $('#' + patter + '').css("z-index", "100001");
        $('#' + patter + '').css("position", "fixed")
        $('#' + patter + '').css("top", "0");
        $('#' + patter + '').css("bottom", "0");
        $('#' + patter + '').css("right", "0");
        $('#' + patter + '').css("left", "0");
        $('#' + patter + '').css("padding", "auto");
        $('#' + patter + '').css("text-align", "center");
        $('#' + patter + '').css("background", "none");
        $('#' + patter + '').css("vertical-align", "vertical-align");
        $("#videCont").css("z-index", "100002");
        $('#' + patter + '').append('<div id="closer_videopopup">&otimes;</div>');
        $("#" + settings.opener + "").on('click', function () {
            $('#' + patter + "").show();
            $('#'+settings.idvideo+'').trigger('play');

        });
        $("#closer_videopopup").on('click', function () {
            if(settings.pausevideo==true){
                    $('#'+settings.idvideo+'').trigger('pause');
                }else{
                    stopVideo();
                }
            $('#' + patter + "").hide();
        });
        return this.css({

        });
    };

}(jQuery));
