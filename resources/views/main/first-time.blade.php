@extends('layouts.default')

@section('page_title')
	{{ $page->page_title }} |
@stop

@section('title')
	{{ $page->title }}
@stop

@section('copy')
	{!! $page->body !!}

    <br/>
    <a target="_blank" href="/pdfs/first_time_client.pdf" class="btn btn-primary btn-sm download">first-time clients</a>
    <a target="_blank" href="/pdfs/physician_permission.pdf" class="btn btn-primary btn-sm download">physician permission</a>
    <a target="_blank" href="/pdfs/physician_referral.pdf" class="btn btn-primary btn-sm download">physician referral</a>

@stop

