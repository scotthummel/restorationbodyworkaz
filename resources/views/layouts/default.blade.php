@include('partials.header')
<body>
<div class="desktop-coronavirus">
    @include('partials.coronavirus')
</div>
<div class="container scroll-page">
    <div class="row">

        @include('partials.navbar')

        <div class="col-lg-3 col-md-3 hidden-sm hidden-xs left-col">
            @include('partials.nav')
        </div>
        <div class="col-md-3 col-xs-12 hidden-md hidden-lg image-slice">
            @include('partials.coronavirus')

            <img src="/images/centerpieces/{{ $page->image }}.jpg" />
        </div>
        <div class="col-lg-3 col-md-3 col-xs-12 hidden-xs hidden-sm center-col">
			<img src="/images/centerpieces/{{ $page->image }}.jpg" />
        </div>
        <div class="col-lg-6 col-md-6 col-xs-12 right-col">
			<h1>@yield('title')</h1>
			<div id="copy">
				@yield('copy')
			</div>
		</div>

	</div>
    @include('partials.footer-links')
@include('partials.footer')
