package it.cnr.isti.visione.services;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.Properties;

import javax.json.Json;

import org.json.JSONObject;

import com.google.gson.Gson;


public class Settings {
	
	private static final String VISIONE_HOME = System.getenv("VISIONE_HOME_4") == null ? ".": System.getenv("VISIONE_HOME_4");
	
	private static final Properties props;

	public static Boolean SEND_LOG_TO_DRES;	
	public static int TEAM_ID;
	public static String MEMBER_ID;
	public static String LUCENE;
	public static String LUCENE_MVK;
	public static String LUCENE_RMAC;
	public static String KEYFRAME_TIMESTAMP;
	public static String KEYFRAME_NUMBER;
	public static String LOG_FOLDER;
	public static String LOG_FOLDER_DRES;
	public static int K;
	public static String THUMBNAILS_FOLDER;
	public static String SUBMIT_SERVICE;
	public static String SUBMIT_SERVER;
	public static String LOG_SERVICE;
	public static String RMAC_SERVICE;
	public static String TERN_SERVICE;
	public static String CLIP_SERVICE;
	public static String CLIP_SERVICE_MVK;
	public static String CLIP_INTERNAL_IMG_SEARCH_SERVICE;
	public static String CLIP_INTERNAL_IMG_SEARCH_SERVICE_MVK;
	public static String SUBMIT_USER;
	public static String SUBMIT_PWD;
	public static String[] RESCORER_PIPELINE;
	public static FieldParameters[] RESCORER_PIPELINE_FIELDS;
	public static String[] FIELD_SIMILARITIES;
	public static float[] RESCORER_PIPELINE_WEIGHTS;
	public static String OBJECTS_WEIGHT;
	public static String BB_WEIGHT;
	public static String TERN_WEIGHT;	
	public static String IMG_SIM_WEIGHT;	
	public static String OBJECTS_SIMILARITY;
	public static String BB_SIMILARITY;
	public static String TERN_SIMILARITY;
	public static String IMG_SIM_SIMILARITY;
	
	public static FieldParameters OBJECT_PARAMETERS;
	public static FieldParameters BB_PARAMETERS;
	public static FieldParameters TERN_PARAMETERS;
	public static FieldParameters IMG_SIM_PARAMETERS;
	
	private static HashMap<String, FieldParameters> FIELD_MAP;
	public static File HYPERSET_FILE;



	static {
		props = new Properties();
		FIELD_MAP = new HashMap<String, FieldParameters>();
		try {
			Gson gson = new Gson();
			props.load(new FileInputStream(new File(VISIONE_HOME + "/conf.properties")));
//			TEAM_ID = Integer.parseInt(props.getProperty("TEAM_ID"));
			MEMBER_ID = props.getProperty("MEMBER_ID");
			LUCENE = props.getProperty("LUCENE");
			LUCENE_MVK = props.getProperty("LUCENE_MVK");
			SEND_LOG_TO_DRES=Boolean.parseBoolean(props.getProperty("SEND_LOG_TO_DRES"));
//			LUCENE_RMAC = props.getProperty("LUCENE_RMAC");
//			KEYFRAME_TIMESTAMP = props.getProperty("KEYFRAME_TIMESTAMP");
//			KEYFRAME_NUMBER = props.getProperty("KEYFRAME_NUMBER");
			LOG_FOLDER = props.getProperty("LOG_FOLDER");
			LOG_FOLDER_DRES = props.getProperty("LOG_FOLDER_DRES");
			K = Integer.parseInt(props.getProperty("K"));
			THUMBNAILS_FOLDER = props.getProperty("THUMBNAILS_FOLDER");
			SUBMIT_SERVICE = props.getProperty("SUBMIT_SERVICE");
			SUBMIT_SERVER = props.getProperty("SUBMIT_SERVER");
			SUBMIT_USER = props.getProperty("SUBMIT_USER");
			SUBMIT_PWD = props.getProperty("SUBMIT_PWD");
			LOG_SERVICE = props.getProperty("LOG_SERVICE");
			RMAC_SERVICE = props.getProperty("RMAC_SERVICE");
			TERN_SERVICE = props.getProperty("TERN_SERVICE");
			CLIP_SERVICE = props.getProperty("CLIP_SERVICE");
			CLIP_SERVICE_MVK = props.getProperty("CLIP_SERVICE_MVK");
			CLIP_INTERNAL_IMG_SEARCH_SERVICE = props.getProperty("CLIP_INTERNAL_IMG_SEARCH_SERVICE");
			CLIP_INTERNAL_IMG_SEARCH_SERVICE_MVK = props.getProperty("CLIP_INTERNAL_IMG_SEARCH_SERVICE_MVK");
			
			OBJECT_PARAMETERS = gson.fromJson(props.getProperty("OBJECTS"), FieldParameters.class);
			FIELD_MAP.put("OBJECTS", OBJECT_PARAMETERS);
			
			BB_PARAMETERS = gson.fromJson(props.getProperty("BB"), FieldParameters.class);
			FIELD_MAP.put("BB", BB_PARAMETERS);

			TERN_PARAMETERS = gson.fromJson(props.getProperty("TERN"), FieldParameters.class);
			FIELD_MAP.put("TERN", TERN_PARAMETERS);

			IMG_SIM_PARAMETERS = gson.fromJson(props.getProperty("IMG_SIM"), FieldParameters.class);
			FIELD_MAP.put("IMG_SIM", IMG_SIM_PARAMETERS);
			
			RESCORER_PIPELINE = props.getProperty("RESCORER_PIPELINE").split(",");
			RESCORER_PIPELINE_FIELDS = new FieldParameters[RESCORER_PIPELINE.length];
			for (int i = 0; i < RESCORER_PIPELINE.length; i++) {
				RESCORER_PIPELINE_FIELDS[i] = FIELD_MAP.get(RESCORER_PIPELINE[i]);
			}
			HYPERSET_FILE = new File(props.getProperty("HYPERSET"));

			

		} catch (IOException e) {
			e.printStackTrace();
		}
	}
	
}
