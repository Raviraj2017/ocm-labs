import {Page, NavController, NavParams, Alert} from 'ionic-angular';
import {AppManager} from '../../core/ocm/services/AppManager';
import {UserProfile, AsyncResult} from '../../ocm-model';


@Page({
    templateUrl: 'build/pages/signin/signin.html'
})
export class SignInPage {
    email: string;
    password: string;

    constructor(public appManager: AppManager, public nav: NavController, params: NavParams) {
        this.email = "test@gmail.com";

        var currentProfile = <UserProfile>params.get("Profile");
        if (currentProfile != null) {
            this.email = currentProfile.EmailAddress;
        }
    }

    cancelSignIn() {
        this.nav.pop();
    }

    performSignIn() {

        //sign in with supplied email address and password
        this.appManager.api.performSignIn(this.email, this.password).then((response) => {


            let alert = Alert.create({
                title: 'Open Charge Map',
                subTitle: 'You are now signed in as ' + this.appManager.api.authResponse.Data.UserProfile.Username,
                buttons: ['Ok']
            });
            this.nav.present(alert);

            localStorage.setItem("authResponse", JSON.stringify(this.appManager.api.authResponse));

            //post test comment
            /*
                        var comment = {
                            "ChargePointID": 60624,
                            "CommentTypeID": 10,
                            "UserName": "A. Nickname",
                            "Comment": "This place is awesome, free cake for EV owners!",
                            "Rating": 5,
                            "RelatedURL": "http://awesomevplace.com",
                            "CheckinStatusTypeID": 0
                        };
                        this.api.submitUserComment(comment);
            */
        }, (reason?:AsyncResult) => {

            let alert = Alert.create({
                title: 'Open Charge Map',
                subTitle: 'Email or Password not recognised:'+JSON.stringify(reason),
                buttons: ['Ok']
            });
            this.nav.present(alert);

            this.appManager.log("Error logging in:" + reason);


        }).catch(err => {
            alert(err);
            this.appManager.log("Error logging in:" + err);
        });
    }
}