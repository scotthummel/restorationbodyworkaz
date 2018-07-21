@include('partials.header')
<body>
<div class="container">
    <div class="row">

        <router-view></router-view>

    </div>
    @include('partials.footer-links')
</div>
@include('partials.footer')
