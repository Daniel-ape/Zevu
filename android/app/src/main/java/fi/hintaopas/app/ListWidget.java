package fi.hintaopas.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Home-screen widget: the active shopping list, what is still to buy and the
 * cheapest shop for it. The app sends the data (WidgetPlugin); a tap opens the list.
 */
public class ListWidget extends AppWidgetProvider {
    static final String PREFS = "zevu_widget";
    private static final int[] ROWS = { R.id.w_row1, R.id.w_row2, R.id.w_row3, R.id.w_row4, R.id.w_row5 };

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) mgr.updateAppWidget(id, build(ctx));
    }

    static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, ListWidget.class));
        if (ids.length > 0) for (int id : ids) mgr.updateAppWidget(id, build(ctx));
    }

    private static RemoteViews build(Context ctx) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_list);
        String raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("data", "");
        String title = "ZEVU", footer = "", empty = "", more = "";
        JSONArray items = new JSONArray();
        try {
            if (raw != null && !raw.isEmpty()) {
                JSONObject o = new JSONObject(raw);
                title = o.optString("title", title);
                footer = o.optString("footer", "");
                empty = o.optString("empty", "");
                more = o.optString("more", "");
                items = o.optJSONArray("items");
                if (items == null) items = new JSONArray();
            }
        } catch (Exception ignored) { }
        v.setTextViewText(R.id.w_title, title);
        for (int k = 0; k < ROWS.length; k++) {
            if (k < items.length()) {
                JSONObject it = items.optJSONObject(k);
                String text = it == null ? "" : it.optString("t", "");
                boolean done = it != null && it.optBoolean("c", false);
                v.setViewVisibility(ROWS[k], View.VISIBLE);
                v.setTextViewText(ROWS[k], (done ? "✓  " : "•  ") + text);
                v.setTextColor(ROWS[k], done ? 0xFF8A9690 : 0xFF10221A);
            } else {
                v.setViewVisibility(ROWS[k], View.GONE);
            }
        }
        boolean none = items.length() == 0;
        v.setViewVisibility(R.id.w_empty, none ? View.VISIBLE : View.GONE);
        v.setTextViewText(R.id.w_empty, empty.isEmpty() ? "ZEVU" : empty);
        v.setViewVisibility(R.id.w_more, more.isEmpty() ? View.GONE : View.VISIBLE);
        v.setTextViewText(R.id.w_more, more);
        v.setViewVisibility(R.id.w_footer, footer.isEmpty() ? View.GONE : View.VISIBLE);
        v.setTextViewText(R.id.w_footer, footer);
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("fi.hintaopas.app://open/lists"), ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.w_root, pi);
        return v;
    }
}
