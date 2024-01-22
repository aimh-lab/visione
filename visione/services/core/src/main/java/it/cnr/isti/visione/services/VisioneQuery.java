package it.cnr.isti.visione.services;

import java.util.HashMap;

public class VisioneQuery {

	public HashMap<String, String> query;
	public HashMap<String, String> parameters;

	public VisioneQuery() {
		this.query = new HashMap<>();
		this.parameters = new HashMap<>();
	}

	public void addQuery(String key, String value) {
		query.put(key, value);
	}

	public void addParameter(String key, String value) {
		parameters.put(key, value);
	}

	public HashMap<String, String> getQuery() {
		return query;
	}

	public HashMap<String, String> getParameters() {
		return parameters;
	}
}
