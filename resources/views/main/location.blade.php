@extends('layouts.default')

@section('page_title')
	{{ $page->page_title }}
@stop

@section('title')
	{{ $page->title }}
@stop

@section('copy')
	{!! $page->body !!}

    <div id="map" style="width:100%; height:410px;"></div>

<script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyApiWkD0IZVSJCDYkCre8g1f3d11JLN9-Y&sensor=false">
</script>
<script type="text/javascript">

    function initialize() {
        var mapOptions = {
            center: new google.maps.LatLng(33.480458,-112.045939),
            zoom: 16,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };
        var map = new google.maps.Map(document.getElementById("map"),
            mapOptions);

        var rbwmt = new google.maps.Marker({
            position: new google.maps.LatLng(33.480458,-112.045939),
            draggable: false,
            //title: "Lambda Phoenix Center"
            //icon: 'http://www.pozsocialphx.com/images/redribbon.png'
        });

        rbwmt.setMap(map);

        var infowindow = new google.maps.InfoWindow();

        var rbwmtInfo = {
            company: 'restoration bodywork and massage therapy',
            address: '1640 east thomas road, back building',
            city: 'phoenix',
            state: 'az',
            zip: '85016',
            phone: '602.695.0809',
            website: 'restoratiobodyworkaz.com',
            image: 'restoration_logo.png'
        }

        infowindow.setContent(infowindowContent(rbwmtInfo));

        infowindow.open(map, rbwmt);
    }

    function infowindowContent(info) {
        var html;

        html  = '<h3><a href="http://www.' + info.website + '" target="_blank" rel="nofollow"><img src="/images/' + info.image + '" width="100"/></a></h3>';
        html += '<p style="margin-bottom:1px;">' + info.address + '</p>';
        html += '<p style="margin-bottom:1px;">' + info.city + ' ' + info.state + ' ' + info.zip + '</p>';
        html += '<p style="margin-bottom:1px;">' + info.phone + '</p>';

        return html;
    }
</script>
@stop

@section('scripts')
<script>
    $(function() {
        initialize();
    });
</script>
@stop

