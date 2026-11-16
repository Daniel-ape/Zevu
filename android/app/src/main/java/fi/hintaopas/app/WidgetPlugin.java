package fi.hintaopas.app;

import android.content.Context;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Lets the app hand the home-screen widget what to show (the active list). */
@CapacitorPlugin(name = "ZevuWidget")
public class WidgetPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        String data = call.getString("data", "");
        Context ctx = getContext();
        ctx.getSharedPreferences(ListWidget.PREFS, Context.MODE_PRIVATE).edit().putString("data", data).apply();
        ListWidget.updateAll(ctx);
        call.resolve();
    }
}
