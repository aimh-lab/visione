from mmdet.apis import init_detector, inference_detector,show_result_pyplot
from tqdm import tqdm
import numpy as np

nn_cc={'mask_rcnn_lvis':['lvis/mask_rcnn_x101_64x4d_fpn_sample1e-3_mstrain_1x_lvis_v1.py', 'mask_rcnn_x101_64x4d_fpn_sample1e-3_mstrain_1x_lvis_v1-43d9edfe.pth' ],
       'vfnet_X-101-32x4d':['vfnet/vfnet_x101_32x4d_fpn_mdconv_c3-c5_mstrain_2x_coco.py','vfnet_x101_32x4d_fpn_mdconv_c3-c5_mstrain_2x_coco_20201027pth-d300a6fc.pth'],
       'vfnet_X-101-64x4d': ['vfnet/vfnet_x101_64x4d_fpn_mdconv_c3-c5_mstrain_2x_coco.py',
                             'vfnet_x101_64x4d_fpn_mdconv_c3-c5_mstrain_2x_coco_20201027pth-b5f6da5e.pth']

       }

def get_images_to_process(images_processed_FN,list_images_FN):
    list_images_f = open(list_images_FN)
    list_images = list_images_f.readlines()
    total_images = len(list_images)
    if (total_images > 0):
        try:
            out_processed = open(images_processed_FN, 'r')
            alredy_processed = out_processed.readlines()
            if (len(alredy_processed) > 0):
                print(f"Skipping {len(alredy_processed)} already processed files..")
                for im in tqdm(alredy_processed, total=len(alredy_processed)):
                    try:
                        list_images.remove(im)
                    except ValueError:
                        pass
                print(f"done")
            out_processed.close()

            del alredy_processed
        except FileNotFoundError:
            print(f"the file {images_processed_FN} does not exist..creating it.")
    list_images_f.close()
    return list_images



def run(name_nn, device,out_FN,list_images_FN,conf_th):
    config_file = '../objects-using-mmDetection/configs/' + nn_cc[name_nn][0]
    checkpoint_file = '../objects-using-mmDetection/checkpoints/' + nn_cc[name_nn][1]
    model = init_detector(config_file, checkpoint_file, device=device)
    class_names = model.CLASSES

    out_processed_FN = f'{out_FN}_processed.txt'
    out_NOT_processed_FN=f'{out_FN}_NOT_processed.txt'
    #
    list_images = get_images_to_process(out_processed_FN, list_images_FN)
    total_images = len(list_images)
    ##
    out_processed = open(out_processed_FN, 'a+')
    out_NOT_processed = open(out_NOT_processed_FN, 'w')
    out_err = open(out_FN + '_err.txt', 'w')

    with open(out_FN, 'a+') as f:
        for line in tqdm(list_images, total=total_images):
            try:
                img = line.strip()

                result = inference_detector(model, img)
                f.write(img + '\n')
                ###
                if isinstance(result, tuple):
                    bbox_result, segm_result = result
                    if isinstance(segm_result, tuple):
                        segm_result = segm_result[0]  # ms rcnn
                else:
                    bbox_result, segm_result = result, None
                bboxes = np.vstack(bbox_result)
                ###
                # bboxes = np.vstack(result)
                labels = [np.full(bbox.shape[0], i, dtype=np.int32) for i, bbox in enumerate(bbox_result)]
                labels = np.concatenate(labels)
                for (bbox, label) in zip(bboxes, labels):
                    bbox_int = bbox.astype(np.int32)
                    if bbox[4] > conf_th:
                        f.write(class_names[label] + ',' + str(bbox[4]) + "," + str(bbox_int[0]) + "," + str(
                            bbox_int[1]) + "," + str(bbox_int[2]) + "," + str(bbox_int[3]) + '\n')
                f.flush()

                out_processed.write(f"{line}")
                out_processed.flush()
                # torch.cuda.empty_cache()

            except Exception as inst:
                out_err.write(f"{inst}")
                out_NOT_processed.write(f"{line}")
                out_NOT_processed.flush()
                out_err.flush()
                print(inst)

    out_err.close()
    out_processed.close()
    out_NOT_processed.close()
    return out_NOT_processed_FN,out_processed_FN