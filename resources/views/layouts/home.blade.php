@include('partials.header')
<body>
	<div class="container">
        <div class="row">

            @include('partials.navbar')

            <div class="col-md-3 hidden-sm hidden-xs left-col">
                @include('partials.nav')
            </div>
            <div class="col-md-3 col-xs-12 hidden-md hidden-lg image-slice">
                <img src="/images/centerpieces/fire.jpg" />
            </div>
            <div class="col-md-4 col-xs-12 hidden-sm hidden-xs center-col">
                <img src="/images/centerpieces/fire.jpg" />
            </div>
            <div class="col-md-5 col-xs-12 right-col front-page">
                <img class="logo" src="{{ url('images/restoration_logo.png') }}" alt="Restoration Body Work and Massage Therapy" />
                <p id="modalities">massage therapy & related bodywork modalities to assist you on your journey to restore wellness to your life</p>
                <p id="address">1640 east thomas road<br/>back building<br/>phoenix, arizona 85016</p>
            </div>

        </div>
        @include('partials.footer-links')
	</div>
@include('partials.footer')