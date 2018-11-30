<?php

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::get('/', 'Main\IndexController@index');
Route::get('about', 'Main\AboutController@index');
Route::get('therapeutic-benefits', 'Main\TherapeuticController@index');
Route::get('contraindications', 'Main\ContraindicationsController@index');
Route::get('modalities', 'Main\ModalitiesController@index');
Route::get('first-time-clients', 'Main\FirstTimeClientsController@index');
Route::get('policies', 'Main\PoliciesController@index');
Route::get('location', 'Main\LocationController@index');
Route::get('links', 'Main\LinksController@index');
Route::get('rates', 'Main\RatesController@index');
Route::get('contact', 'Main\ContactController@index');
Route::post('contact', 'Main\ContactController@store');
Route::get('thank-you', 'Main\ContactController@thankYou');
Route::get('error', 'Main\ContactController@error');