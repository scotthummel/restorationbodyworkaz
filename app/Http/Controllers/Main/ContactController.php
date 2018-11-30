<?php namespace App\Http\Controllers\Main;

use App\Rbwmt\Repositories\PagesRepository;
use App\Http\Controllers\Controller;
use App\Rbwmt\Mailers\ContactMailer;
use App\Rbwmt\Mailers\ThankYouMailer;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ContactController extends Controller {

    public function __construct(PagesRepository $page)
    {
        $this->page = $page;
    }

	/**
	 * Display a listing of the resource.
	 *
	 * @return Response
	 */
	public function index()
	{
        $page = $this->page->getWhereSlug('contact');
		return view('main.contact')->with('page', $page);
	}

	/**
	 * Show the form for creating a new resource.
	 *
	 * @return Response
	 */
	public function create()
	{
		//
	}

    /**
     * Store a newly created resource in storage.
     *
     * @param Request $request
     * @return Response
     */
	public function store(Request $request)
	{
		try {
            $this->validate($request, [
                'name'  => 'required',
                'email' => 'required|email',
                'message' => 'required'
            ]);

            $user = new \stdClass();

            $user->subject     = 'Message from the Website';

            $user->name        = $request->get('name');
            $user->email       = $request->get('email');
            $user->phone       = $request->get('phone');
            $user->messageText = $request->get('message');

            $mailer = new ContactMailer($user);
            $mailer->contact()->deliver();

            $thanks = new ThankYouMailer($user);
            $thanks->contact()->deliver();

            return redirect()->to('thank-you');
        } catch (\Exception $e) {
            return redirect()->to('error');
        }
	}

	/**
	 * Display the specified resource.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function show($id)
	{
		//
	}

	/**
	 * Show the form for editing the specified resource.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function edit($id)
	{
		//
	}

	/**
	 * Update the specified resource in storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function update($id)
	{
		//
	}

	/**
	 * Remove the specified resource from storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function destroy($id)
	{
		//
	}

	public function thankYou() {
        $page = $this->page->getWhereSlug('thank-you');
        return view('main.thank-you', [
            'page' => $page
        ]);
    }

    public function error() {
        $page = $this->page->getWhereSlug('contact');
        return view('main.error', [
            'page' => $page
        ]);
    }

}