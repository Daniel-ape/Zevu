package fi.hintaopas.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Rect;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/**
 * Reads the text of a receipt or shelf-label photo with Google's on-device
 * text recognition (ML Kit, the Latin model bundled in the app: nothing is
 * sent anywhere). Gives back each line with where it is in the picture
 * (0–1, top left origin), so the app can put product names and prices back
 * on the same row.
 */
@CapacitorPlugin(name = "ZevuOcr")
public class TextReaderPlugin extends Plugin {
    @PluginMethod
    public void read(PluginCall call) {
        String b64 = call.getString("base64");
        if (b64 == null) { call.reject("No image"); return; }
        byte[] bytes;
        try { bytes = Base64.decode(b64, Base64.DEFAULT); } catch (IllegalArgumentException e) { call.reject("Bad image"); return; }
        Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        if (bmp == null) { call.reject("No image"); return; }
        final float w = bmp.getWidth(), h = bmp.getHeight();
        TextRecognizer reader = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        reader.process(InputImage.fromBitmap(bmp, 0))
            .addOnSuccessListener(text -> {
                JSArray lines = new JSArray();
                for (Text.TextBlock block : text.getTextBlocks()) {
                    for (Text.Line line : block.getLines()) {
                        Rect r = line.getBoundingBox();
                        if (r == null) continue;
                        JSObject o = new JSObject();
                        o.put("text", line.getText());
                        o.put("x", r.left / w);
                        o.put("y", r.top / h);
                        o.put("w", r.width() / w);
                        o.put("h", r.height() / h);
                        lines.put(o);
                    }
                }
                JSObject res = new JSObject();
                res.put("lines", lines);
                call.resolve(res);
                reader.close();
            })
            .addOnFailureListener(e -> {
                call.reject(e.getMessage() == null ? "Could not read" : e.getMessage());
                reader.close();
            });
    }
}
