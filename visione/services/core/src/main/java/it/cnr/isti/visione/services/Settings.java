package it.cnr.isti.visione.services;

import java.io.InputStream;
// import java.io.InputStreamReader;
// import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.yaml.snakeyaml.Yaml;

public class Settings {

	// DRES-related settings
	public static Boolean SEND_LOG_TO_DRES;
	public static String SUBMIT_SERVER;
	public static String SUBMIT_USER;
	public static String SUBMIT_PWD;
	public static String MEMBER_ID;
	public static int TEAM_ID = 0;

	// paths
	public static String LUCENE;
	public static Boolean SAVE_LOGS;
	public static String LOG_FOLDER;
	public static String LOG_FOLDER_DRES;

	// search pipeline settings
	public static int K;
	public static String[] RESCORER_PIPELINE;
	public static FieldParameters[] RESCORER_PIPELINE_FIELDS;

	// service URLs
	public static String RMAC_SERVICE;
	public static String ALADIN_SERVICE;
	public static String CLIP_SERVICE;
	public static String CLIP_INTERNAL_IMG_SEARCH_SERVICE;
	public static String CLIP_ONE_SERVICE;
	public static String CLIP_ONE_INTERNAL_IMG_SEARCH_SERVICE;

	public static Map<String, FieldParameters> FIELD_PARAMETERS_MAP = new HashMap<String, FieldParameters>();

	// default values
	private static final List<String> DEFAULT_RESCORER_PIPELINE = Arrays.asList("OBJECTS", "BB", "ALADIN");
	private static final Map<String, FieldParameters> DEFAULT_FIELD_PARAMETERS_MAP = new HashMap<String, FieldParameters>() {
		{
			put("OBJECTS", new FieldParameters("objects", 1.0f, "DotProduct"));
			put("BB", new FieldParameters("txt", 1.0f, "CosineSimilarity"));
			put("ALADIN", new FieldParameters("aladin", 0.00005f, "DotProduct"));
			put("CLIP", new FieldParameters("clip", 1.0f, "CosineSimilarity"));
			put("IMG_SIM", new FieldParameters("features", 1.0f, "DotProduct"));
		}
	};

	public static void init(InputStream is) {
		Yaml yaml = new Yaml();
		// is = new InputStreamReader(is, StandardCharsets.UTF_8);
		Map<String, Object> config = yaml.load(is);
		Map<String, Object> coreConfig = (Map<String, Object>) config.getOrDefault("core", new HashMap<String, Object>());
		Map<String, Object> dresConfig = (Map<String, Object>) config.getOrDefault("dres", new HashMap<String, Object>());

		// DRES-related settings
		SUBMIT_SERVER = (String) dresConfig.getOrDefault("endpoint", "http://router/dres");
		SUBMIT_USER = (String) dresConfig.getOrDefault("username", "visione");
		SUBMIT_PWD = (String) dresConfig.getOrDefault("password", "visione");
		SEND_LOG_TO_DRES = (Boolean) dresConfig.getOrDefault("send_logs", false);
		MEMBER_ID = (String) dresConfig.getOrDefault("member_id", "visione");

		// Paths
		LUCENE = (String) coreConfig.getOrDefault("index_path", "/data/lucene-index");
		SAVE_LOGS = (Boolean) coreConfig.getOrDefault("save_logs", false);
		LOG_FOLDER = (String) coreConfig.getOrDefault("log_path", "/data/logs");
		LOG_FOLDER_DRES = (String) coreConfig.getOrDefault("log_dres_path", "/data/logs_dres");

		// Search pipeline settings
		K = (Integer) config.getOrDefault("K", 10000);

		DEFAULT_FIELD_PARAMETERS_MAP.forEach((field, fp) -> {
			// Load field parameters overrides
			if (coreConfig.containsKey(field)) {
				Map<String, Object> fieldConfig = (Map<String, Object>) coreConfig.get(field);
				fp = FieldParameters.fromMap(fieldConfig);
			}
			FIELD_PARAMETERS_MAP.put(field, fp);
		});

		RESCORER_PIPELINE = ((List<String>) coreConfig.getOrDefault("RESCORER_PIPELINE", DEFAULT_RESCORER_PIPELINE)).toArray(new String[0]);
		RESCORER_PIPELINE_FIELDS = new FieldParameters[RESCORER_PIPELINE.length];
		for (int i = 0; i < RESCORER_PIPELINE.length; i++) {
			RESCORER_PIPELINE_FIELDS[i] = FIELD_PARAMETERS_MAP.get(RESCORER_PIPELINE[i]);
		}

		// Service URLs (TODO)
		RMAC_SERVICE = (String) coreConfig.get("RMAC_SERVICE");
		ALADIN_SERVICE = (String) coreConfig.get("ALADIN_SERVICE");
		CLIP_SERVICE = (String) coreConfig.get("CLIP_SERVICE");
		CLIP_INTERNAL_IMG_SEARCH_SERVICE = (String) coreConfig.get("CLIP_INTERNAL_IMG_SEARCH_SERVICE");
		CLIP_ONE_SERVICE = (String) coreConfig.get("CLIP_ONE_SERVICE");
		CLIP_ONE_INTERNAL_IMG_SEARCH_SERVICE = (String) coreConfig.get("CLIP_ONE_INTERNAL_IMG_SEARCH_SERVICE");
	}

}
