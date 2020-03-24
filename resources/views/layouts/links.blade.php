@include('partials.header')
<body>
<div class="desktop-coronavirus">
    @include('partials.coronavirus')
</div>
	<div id="container">
		<div id="leftCol">
			@include('partials.nav')
		</div>
		<div id="centerCol">
			<img src="/images/centerpieces/{{ $page->image }}.jpg" />
		</div>
		<div id="rightCol">
			<h1>@yield('title')</h1>
			<div id="copy">
				@yield('copy')
			</div>
		</div>
	</div>
@include('partials.footer')
