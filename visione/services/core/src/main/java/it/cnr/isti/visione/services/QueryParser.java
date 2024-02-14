package it.cnr.isti.visione.services;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import org.json.JSONArray;
import org.json.JSONObject;

public class QueryParser {

	public static List<VisioneQuery> getQueries(String jsonQuery) {
		List<VisioneQuery> queries = new ArrayList<>();
		JSONObject obj = new JSONObject(jsonQuery);
		JSONArray queryArr = obj.getJSONArray("query");
		String queryArrString = queryArr.toString();
		if (queryArrString.length() > 500)
			queryArrString = queryArrString.substring(0, 500) + "...";
		System.out.println(queryArrString);
		for (int i = 0; i < queryArr.length(); i++) {
			VisioneQuery query = new VisioneQuery();
			JSONObject jsonObject = queryArr.getJSONObject(i);
			Iterator<String> keys = jsonObject.keys();
			while (keys.hasNext()) {
				String key = keys.next();
				String value = jsonObject.getString(key);
				query.addQuery(key, value);
			}
			queries.add(query);
		}

		if (!obj.isNull("parameters")) {
			JSONArray parametersArr = obj.getJSONArray("parameters");
			System.out.println(parametersArr);

			for (int i = 0; i < parametersArr.length(); i++) {
				VisioneQuery query = queries.get(i);
				JSONObject jsonObject = parametersArr.getJSONObject(i);
				Iterator<String> keys = jsonObject.keys();
				while (keys.hasNext()) {
					String key = keys.next();
					String value = jsonObject.getString(key);
					query.addParameter(key, value);
				}
				queries.set(i, query);
			}
		}
		return queries;
	}

	public static void main(String args[]) {
		String json = "{\"field\":\"objects\", \"similarity\":\"DotProduct\", \"weight\":\"1.0\"}";
		JSONObject arr = new JSONObject(json);
		String field = arr.getString("field");
		System.out.println(field);
	}
}
