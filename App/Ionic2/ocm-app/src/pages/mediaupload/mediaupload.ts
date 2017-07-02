import { AppManager } from './../../providers/AppManager';
import { Component } from '@angular/core';
import { NavController, NavParams, ViewController } from 'ionic-angular';
import { Camera } from '@ionic-native/camera';

@Component({
    templateUrl: 'mediaupload.html'
})
export class MediaUploadPage {

    mode: string;
    processingQuality: number;
    imgData: any;
    targetWidth: number;
    targetHeight: number;

    comment: string;
    chargePointId: number;
    poi: any;

    constructor(
        public navParams: NavParams,
        public appManager: AppManager,
        public nav: NavController,
        public view: ViewController,
        private camera: Camera
    ) {

        this.processingQuality = 0.8;
        this.targetWidth = 1024;
        this.targetHeight = 800;
        this.mode = appManager.platformMode;


        this.chargePointId = this.navParams.get('id');
        this.poi = this.navParams.get('poi');
        this.comment = "";
    }

    loadCameraOrLibraryImage() {


        if (!this.isBrowserMode()) {
            this.camera.getPicture({ targetWidth: this.targetWidth }).then((imageData) => {
                // imageData is either a base64 encoded string or a file URI
                // If it's base64:
                //let base64Image = "data:image/jpeg;base64," + imageData;
                this.imgData = imageData;
                this.processImage();
            }, (err) => {
            });
        }

        if (this.isBrowserMode()) {
            var reader = new FileReader();

            reader.onload = () => {
                this.imgData = reader.result;
                this.processImage();
            };

            reader.onerror = () => {
                //alert("reader error");
            };

            //read data from file input, this will then fire the onload event
            reader.readAsDataURL((<any>document.getElementById("img-upload-media")).files[0]);
        }

    }

    isBrowserMode(): boolean {
        return (this.appManager.isPlatform("core") || this.appManager.isPlatform("mobileweb"));
    }

    processImage() {
        var _appContext = this;
        if (this.imgData != null) {
            // create an off-screen canvas
            var canvas = <HTMLCanvasElement>document.getElementById('img-upload-canvas');
            var ctx = canvas.getContext('2d');

            // set its dimension to target size

            // draw source image into the off-screen canvas:
            //ctx.drawImage(this.img, 0, 0, this.targetWidth, this.targetHeight);

            var img = new Image();

            img.onload =  () =>{
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.fillStyle = "rgb(0,0,0)";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                this.refreshImageFromCanvas();
            }

            img.src = this.imgData;

        }
    }

    refreshImageFromCanvas() {
        var canvas = <HTMLCanvasElement>document.getElementById('img-upload-canvas');
        // encode image to data-uri with base64 version of compressed image
        this.imgData = canvas.toDataURL('image/png');

        //now ready to upload      
        (<HTMLImageElement>document.getElementById("preview")).src = this.imgData;
    }

    rotateImage() {
        //inspired by:http://jsfiddle.net/gfcarv/t4YX4/
        var canvas = <HTMLCanvasElement>document.getElementById('img-upload-canvas');

        // store current data to an image
        var rotatedImage = new Image();
        rotatedImage.src = canvas.toDataURL();

        rotatedImage.onload = () => {
            // reset the canvas with new dimensions
            var origHeight = canvas.height;
            var origWidth = canvas.width;
            canvas.width = origHeight;
            canvas.height = origWidth;

            origHeight = canvas.height;
            origWidth = canvas.width;

            var ctx = canvas.getContext('2d');
            ctx.save();

            ctx.translate(origWidth, origHeight / origWidth);
            ctx.rotate(Math.PI / 2);

            ctx.drawImage(rotatedImage, 0, 0);
            ctx.restore();

            rotatedImage = null;

            this.refreshImageFromCanvas();
        }
    }

    performUpload() {

        let submission = {
            chargePointID: this.chargePointId,
            comment: this.comment,
            imageDataBase64: this.imgData
        };

        this.appManager.showLoadingProgress(this.nav, "Uploading photo..");
        this.appManager.submitMediaItem(submission).then((result) => {
            this.appManager.dismissLoadingProgress().then(() => {
                this.appManager.showToastNotification(this.nav, "Upload completed");
                //this.nav.pop();
                this.view.dismiss();
            });

            //todo: refresh POI details to show new upload
        }, (rejected) => {
            this.appManager.dismissLoadingProgress().then(() => {

                this.appManager.showToastNotification(this.nav, "Upload failed, please try again.");
            });

        });
    }

    cancel() {
        this.view.dismiss();
    }
}
