@extends('layouts.default')

@section('page_title')
	{{ $page->page_title }} |
@stop

@section('title')
	{{ $page->title }}
@stop

@section('copy')
	@foreach ($links as $link)
		<h2>{{ $link->title }}</h2>
		<p>{{ $link->description }}</p>
		<p><a href="{{ $link->link }}" target="_blank" rel="nofollow">Visit Site</a>
	@endforeach
@stop

