@extends('layouts.default')

@section('page_title')
    {{ $page->page_title }} |
@stop

@section('title')
    {{ $page->title }}
@stop

@section('copy')

    {!! $page->body !!}

    <form action="/contact" method="POST">

        <div class="form-group">
            <label for="name">Name:</label>
            <input type="text" class="form-control" name="name" />

            {!! $errors->first('name', '<p style="margin-top: 10px;color:#FFF;" class="error">:message</p>') !!}
        </div>


        <div class="form-group">
            <label for="phone">Phone:</label>
            <input type="text" class="form-control" name="phone" />

            {!! $errors->first('email', '<p style="margin-top: 10px;color:#FFF;" class="error">:message</p>') !!}
        </div>

        <div class="form-group">
            <label for="email">Email:</label>
            <input type="email" class="form-control" name="email" />

            {!! $errors->first('email', '<p style="margin-top: 10px;color:#FFF;" class="error">:message</p>') !!}
        </div>

        <div class="form-group">
            <label for="name">Message:</label>
            <textarea class="form-control" name="message"></textarea>

            {!! $errors->first('message', '<p style="margin-top: 10px;color:#FFF;" class="error">:message</p>') !!}
        </div>

        <button type="submit" class="btn btn-primary pull-right">send email</button>
    </form>

@stop

