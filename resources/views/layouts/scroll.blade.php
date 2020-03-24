@include('partials.header')
<body>
<div class="desktop-coronavirus">
    @include('partials.coronavirus')
</div>
<div class="container scroll-page">
    <div class="row">
        @include('partials.navbar')

        <div class="col-md-3 hidden-sm hidden-xs left-col">
            @include('partials.nav')
        </div>
        <div class="col-md-3 col-xs-12 hidden-md hidden-lg image-slice">
            @include('partials.coronavirus')

            <img src="/images/centerpieces/{{ $page->image }}.jpg" />
        </div>
        <div class="col-md-3 col-xs-12 hidden-sm hidden-xs center-col">
            <img src="/images/centerpieces/{{ $page->image }}.jpg" />
        </div>
        <div class="col-md-6 col-xs-12 right-col">
			<h1>@yield('title')</h1>
			<div id="copy">
				<div id="scroll">
					@yield('copy')
                </div>
			</div>
		</div>
	</div>
   </div>
   @include('partials.footer-links')
@include('partials.footer')
