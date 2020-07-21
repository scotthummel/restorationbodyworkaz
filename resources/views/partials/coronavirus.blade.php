<div class="coronavirus desktop">
    @php $today  =\Carbon\Carbon::now(); @endphp
    @if ($today->greaterThan(\Carbon\Carbon::create(2020, 07, 23)))
        <h1>Now Open!</h1>
        <p>We are now open for business. Please call <a style="color: #FFF; text-decoration: underline;" href="tel:6026950809">(602) 695-0809</a> to schedule an appointment today.</p>
    @else
        <h1>Opening Soon!</h1>
        <p>We will be reopening for business July 23. Please call <a style="color: #FFF; text-decoration: underline;" href="tel:6026950809">(602) 695-0809</a> to schedule an appointment today.</p>
    @endif
</div>
