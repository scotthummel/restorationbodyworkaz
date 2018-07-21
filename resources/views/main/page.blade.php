@extends('layouts.default')

@section('page_title')
	{{ $page->page_title }} |
@stop

@section('title')
	{{ $page->title }}
@stop

@section('copy')
	{!! $page->body !!}
@stop

