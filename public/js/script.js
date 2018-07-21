$(function() {
//	$('.button').on('mouseover', function(e) {
//		var $marginLefty = $(e.currentTarget);
//		$marginLefty.animate({ marginLeft: parseInt($marginLefty.css('marginLeft'),10) === 0 ?
//			$marginLefty.outerWidth() : 0
//		});
//    });


    // active navigation
    var path = window.location.pathname;
    var pathArray = path.split('/');
    var href = pathArray[1];

    var anchors = $('.button a');
    for (var i = 0; i < anchors.length; i++ ) {
        if (path === anchors[i].getAttribute('href')) {
            $('li[data-nav="' +  href + '"]').addClass('active');
        }
    }

    $('.download').click(function() {
        window.open($(this).attr('data-href'));
    });
});